import { AudioEngine } from '../audio/audio-engine';
import { PORT_NAME, SPECTRUM_BARS } from '../shared/messages';
import type { ContentToPopup, EngineState, PlaybackStatus, PopupToContent } from '../shared/messages';
import { defaultSettings } from '../shared/settings';
import { loadSettings, onSettingsChanged } from '../shared/storage';
import type { Settings } from '../shared/types';
import { currentTitle, findVideo, isPlaying, onNavigate } from './youtube';

const VIDEO_EVENTS = ['play', 'pause', 'playing', 'ended', 'emptied', 'loadedmetadata'] as const;

/**
 * Content-script controller: owns the single AudioEngine of this tab, follows the active
 * <video> through YouTube's SPA navigation and talks to the popup over a long-lived port.
 */
class Controller {
  private settings: Settings = defaultSettings();
  private video: HTMLVideoElement | null = null;
  private ports = new Set<chrome.runtime.Port>();
  private engine = new AudioEngine(() => this.publishStatus());
  private lastStatus = '';
  private cleanups: Array<() => void> = [];
  private syncTimer: number | null = null;
  private vizTimer: number | null = null;
  private heartbeat: number | null = null;
  private lastFrameEmpty = false;

  async start(): Promise<void> {
    this.settings = await loadSettings();
    this.engine.apply(this.settings);

    this.cleanups.push(
      onSettingsChanged((s) => {
        this.settings = s;
        this.engine.apply(s);
        this.sync();
        this.updateViz();
        this.publishStatus();
      }),
      onNavigate(() => this.scheduleSync()),
    );

    const mo = new MutationObserver(() => this.scheduleSync());
    mo.observe(document.documentElement, { childList: true, subtree: true });
    this.cleanups.push(() => mo.disconnect());

    chrome.runtime.onConnect.addListener(this.onConnect);
    this.cleanups.push(() => chrome.runtime.onConnect.removeListener(this.onConnect));

    // Slow heartbeat: title / playing changes and detection of an orphaned script
    // (extension reloaded while the tab stayed open).
    this.heartbeat = window.setInterval(() => {
      if (!chrome.runtime?.id) {
        this.shutdown();
        return;
      }
      this.sync();
      this.publishStatus();
    }, 1000);

    this.sync();
  }

  private shutdown(): void {
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    if (this.vizTimer !== null) window.clearInterval(this.vizTimer);
    if (this.syncTimer !== null) window.clearTimeout(this.syncTimer);
    this.detachVideoListeners();
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.engine.dispose(); // routes audio straight to the speakers again
  }

  private scheduleSync(): void {
    if (this.syncTimer !== null) return;
    this.syncTimer = window.setTimeout(() => {
      this.syncTimer = null;
      this.sync();
    }, 250);
  }

  /** Make sure the engine is attached to whatever <video> is currently the main one. */
  private sync(): void {
    const video = findVideo();
    if (video !== this.video) {
      this.detachVideoListeners();
      this.video = video;
      if (video) for (const e of VIDEO_EVENTS) video.addEventListener(e, this.onVideoEvent);
      this.publishStatus();
    }
    if (video && (this.settings.enabled || this.engine.hasAttached)) void this.engine.attach(video);
  }

  private detachVideoListeners(): void {
    if (!this.video) return;
    for (const e of VIDEO_EVENTS) this.video.removeEventListener(e, this.onVideoEvent);
  }

  private onVideoEvent = (ev: Event): void => {
    if (ev.type === 'play' && this.engine.hasAttached) void this.engine.resume();
    if (ev.type === 'loadedmetadata' || ev.type === 'emptied') this.sync();
    this.publishStatus();
  };

  private engineState(): EngineState {
    if (!this.video) return 'no-video';
    const st = this.engine.status;
    if (st === 'error') return 'error';
    if (!this.settings.enabled) return this.engine.hasAttached ? 'bypassed' : 'off';
    return st === 'active' ? 'active' : 'blocked';
  }

  private status(): PlaybackStatus {
    return {
      title: currentTitle(this.video),
      playing: isPlaying(this.video),
      engine: this.engineState(),
      detail: this.engine.detail,
    };
  }

  private post(msg: ContentToPopup): void {
    for (const p of this.ports) {
      try {
        p.postMessage(msg);
      } catch {
        this.ports.delete(p);
      }
    }
  }

  private publishStatus(): void {
    if (this.ports.size === 0) return;
    const status = this.status();
    const key = JSON.stringify(status);
    if (key === this.lastStatus) return;
    this.lastStatus = key;
    this.post({ type: 'status', status });
  }

  private onConnect = (port: chrome.runtime.Port): void => {
    if (port.name !== PORT_NAME) return;
    this.ports.add(port);
    port.onMessage.addListener((m: PopupToContent) => {
      if (m.type === 'resume') void this.engine.resume().then(() => this.sync());
    });
    port.onDisconnect.addListener(() => {
      this.ports.delete(port);
      this.updateViz();
    });
    this.lastStatus = '';
    this.sync();
    this.publishStatus();
    this.updateViz();
  };

  /** Spectrum frames are only produced while a popup is listening. */
  private updateViz(): void {
    const want = this.ports.size > 0 && this.settings.visualizer.enabled;
    if (want && this.vizTimer === null) {
      this.vizTimer = window.setInterval(() => this.sendFrame(), 1000 / 30);
    } else if (!want && this.vizTimer !== null) {
      window.clearInterval(this.vizTimer);
      this.vizTimer = null;
    }
  }

  private sendFrame(): void {
    const bars = this.engine.getSpectrum(SPECTRUM_BARS);
    const empty = bars.every((b) => b === 0);
    if (empty && this.lastFrameEmpty) return; // idle: stop sending zeros
    this.lastFrameEmpty = empty;
    this.post({ type: 'spectrum', bars });
  }
}

void new Controller().start();

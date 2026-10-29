import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Frame } from "../motion";
export class Camera {
  stream: MediaStream | null = null;
  model: PoseLandmarker | null = null;
  active = false;
  lastTime = -1;
  frames: Frame[] = [];
  recording = false;
  raf = 0;
  constructor(
    public video: HTMLVideoElement,
    private receive: (f: Frame) => void,
    private fail: (s: string) => void,
  ) {}
  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: 30 },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      const files = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm",
      );
      const opts = {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU" as "GPU" | "CPU",
        },
        runningMode: "VIDEO" as const,
        numPoses: 1,
      };
      try {
        this.model = await PoseLandmarker.createFromOptions(files, opts);
      } catch {
        opts.baseOptions.delegate = "CPU";
        this.model = await PoseLandmarker.createFromOptions(files, opts);
      }
      this.active = true;
      this.loop();
    } catch (e) {
      this.stop();
      this.fail(
        `Camera unavailable: ${e instanceof Error ? e.message : String(e)}. Allow camera access, or use keyboard demo.`,
      );
    }
  }
  loop = () => {
    if (!this.active || !this.model) return;
    try {
      if (
        this.video.currentTime !== this.lastTime &&
        this.video.readyState >= 2
      ) {
        this.lastTime = this.video.currentTime;
        const t = performance.now();
        const result = this.model.detectForVideo(this.video, t);
        const f = { t, points: result.landmarks[0] || [] };
        this.receive(f);
        if (this.recording) {
          this.frames.push(f);
          this.frames = this.frames.filter((x) => t - x.t <= 30000);
        }
      }
      this.raf = requestAnimationFrame(this.loop);
    } catch (e) {
      this.stop();
      this.fail(`Pose detection stopped: ${String(e)}`);
    }
  };
  stop() {
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.model?.close();
    this.model = null;
    this.lastTime = -1;
  }
}

// The four sound switches (prefs.ts) onto what each one drives, and nothing else: the music volume
// onto the mixer's music bus (0 = off; the HUD's ♪ taps it off and back, musicTap), voice onto the
// word clips and barks (core's setSound: game.ts plays neither while it is off, bar an explicit tap),
// sound effects onto the sfx bus, ambience onto the ambient bus. Every change is saved at once.
import { musicSlider, musicTap, type Prefs } from "./prefs";

export interface SoundBuses {
  musicVolume(v: number): void;
  /** the voices: the word clips and the barks (core's setSound) */
  voice(on: boolean): void;
  sfx(on: boolean): void;
  ambience(on: boolean): void;
}

export class SoundSwitches {
  constructor(
    private prefs: Prefs,
    private save: () => void,
    private buses: SoundBuses,
  ) {}

  get musicOn(): boolean {
    return this.prefs.music > 0;
  }

  /** The ♪ tap: music off, or back at its last volume; whether it is on now. */
  tapMusic(): boolean {
    Object.assign(this.prefs, musicTap(this.prefs));
    this.save();
    this.buses.musicVolume(this.prefs.music);
    return this.musicOn;
  }

  /** The Settings slider (0..1). */
  setMusic(v: number) {
    Object.assign(this.prefs, musicSlider(this.prefs, v));
    this.save();
    this.buses.musicVolume(this.prefs.music);
  }

  setVoice(on: boolean) {
    this.prefs.voice = on;
    this.save();
    this.buses.voice(on);
  }

  setSfx(on: boolean) {
    this.prefs.sfx = on;
    this.save();
    this.buses.sfx(on);
  }

  setAmbience(on: boolean) {
    this.prefs.ambience = on;
    this.save();
    this.buses.ambience(on);
  }
}

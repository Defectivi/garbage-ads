export class AudioSystem {
  enabled = true; private context?: AudioContext; private wind?: { source: AudioBufferSourceNode; gain: GainNode }; private stepTime = 0;
  unlock() { this.context ??= new AudioContext(); void this.context.resume(); }
  tone(kind: 'collect' | 'deposit' | 'chop' | 'step' | 'warning' | 'win' | 'lose') {
    if (!this.enabled || !this.context) return;
    const ctx = this.context;
    if (kind === 'step' && ctx.currentTime - this.stepTime < .28) return;
    if (kind === 'step') this.stepTime = ctx.currentTime;
    const frequencies = { collect: 640, deposit: 180, chop: 90, step: 65, warning: 330, win: 520, lose: 140 };
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = kind === 'chop' || kind === 'step' ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(frequencies[kind], ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(frequencies[kind] * (kind === 'lose' ? .4 : 1.6), ctx.currentTime + .16);
    g.gain.setValueAtTime(kind === 'step' ? .025 : .09, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .23);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .25);
  }
  ambience(active: boolean) {
    if (this.wind) { this.wind.source.stop(); this.wind = undefined; }
    if (!active || !this.enabled || !this.context) return;
    const c = this.context, b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
    source.buffer = b; source.loop = true; filter.type = 'lowpass'; filter.frequency.value = 380; gain.gain.value = .035;
    source.connect(filter).connect(gain).connect(c.destination); source.start(); this.wind = { source, gain };
  }
}

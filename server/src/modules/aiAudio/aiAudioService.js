class AiAudioProvider {
  async textToSpeech() { throw new Error('AI audio provider is not configured'); }
  async generateTranscript() { throw new Error('AI audio provider is not configured'); }
}

class AiAudioService {
  constructor(provider = new AiAudioProvider()) { this.provider = provider; }
  textToSpeech(input) { return this.provider.textToSpeech(input); }
  generateTranscript(input) { return this.provider.generateTranscript(input); }
}

module.exports = {AiAudioProvider, AiAudioService};

import { generalAiHelpTopic, isBareGreeting } from './ai-safety';

describe('free-tier AI support privacy', () => {
  it('classifies supported general app questions into fixed topics', () => {
    expect(generalAiHelpTopic('How do I use tasbih?')).toBe(
      'using the dhikr counter',
    );
    expect(generalAiHelpTopic('How does matching work?')).toBe(
      'finding matches and starting conversations',
    );
  });

  it('routes personal or sensitive topics to a human', () => {
    expect(generalAiHelpTopic('My payment was charged twice')).toBeNull();
    expect(
      generalAiHelpTopic('I need help with my health disclosure'),
    ).toBeNull();
    expect(
      generalAiHelpTopic('Please help, my email is person@example.com'),
    ).toBeNull();
    expect(generalAiHelpTopic('Someone is harassing me')).toBeNull();
  });

  it('does not treat a greeting with additional private details as a bare greeting', () => {
    expect(isBareGreeting('Assalamu alaikum')).toBe(true);
    expect(isBareGreeting('Hello, I need help with my account')).toBe(false);
  });
});

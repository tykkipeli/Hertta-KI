import { decide, choosePass } from "./ai.js";
import { describePass } from "./strategy.js";
self.onmessage = (event) => {
  const message = event.data;
  try {
    const result =
      message.type === "pass"
        ? { cards: choosePass(message.hand, { direction: message.direction }) }
        : decide(message.observation, { milliseconds: message.milliseconds });
    if (message.type === "pass")
      result.explanation = describePass(message.hand, result.cards);
    self.postMessage({ id: message.id, ...result });
  } catch (error) {
    self.postMessage({ id: message.id, error: String(error) });
  }
};

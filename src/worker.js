import { decide, choosePass } from "./ai.js";
self.onmessage = (event) => {
  const message = event.data;
  try {
    const result =
      message.type === "pass"
        ? { cards: choosePass(message.hand, { direction: message.direction }) }
        : decide(message.observation, { milliseconds: message.milliseconds });
    self.postMessage({ id: message.id, ...result });
  } catch (error) {
    self.postMessage({ id: message.id, error: String(error) });
  }
};

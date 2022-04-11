export type EventHandler<Event> = (event: Event) => void;

export type Handlers<Events extends object> = {
  [EventName in keyof Events]: Set<EventHandler<Events[EventName]>>;
};

export class EventEmitter<Events extends object> {
  private handlers: Handlers<Events> = {} as Handlers<Events>;

  public on<EventName extends keyof Events>(
    eventName: EventName,
    handler: EventHandler<Events[EventName]>
  ): EventEmitter<Events> {
    if (!this.handlers[eventName]) this.handlers[eventName] = new Set();
    this.handlers[eventName].add(handler);
    return this;
  }

  public off<EventName extends keyof Events>(
    eventName: EventName,
    handler: EventHandler<Events[EventName]>
  ): EventEmitter<Events> {
    if (this.handlers[eventName]) this.handlers[eventName].delete(handler);
    return this;
  }

  public emit<EventName extends keyof Events>(
    eventName: EventName,
    event: Events[EventName]
  ): EventEmitter<Events> {
    const eventHandlers = this.handlers[eventName];

    if (eventHandlers) {
      eventHandlers.forEach((handler) => handler(event));
    }

    return this;
  }
}

const events = new EventEmitter<{
  set: { type: string };
  delete: { id: string; date: Date };
  init: void;
}>();

events
  .on("set", (event) => {
    console.log(event.type);
  })
  .on("delete", (event) => {
    console.log(event.id);
    console.log(event.date);
  });

events.emit("set", { type: "change" });

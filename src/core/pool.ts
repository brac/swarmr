// Generic object pool. Anything that spawns in bulk and dies fast (projectiles,
// enemies, XP gems, damage numbers) comes from a pool — zero `new` in the hot
// path. Pre-allocate to expected peak so steady-state never calls the factory.

export class Pool<T> {
  private free: T[] = [];
  private factory: () => T;
  private reset: ((obj: T) => void) | undefined;

  constructor(factory: () => T, prealloc: number, reset?: (obj: T) => void) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < prealloc; i++) this.free.push(factory());
  }

  /** Hand out an object. Grows past prealloc if exhausted (size to avoid it). */
  acquire(): T {
    const obj = this.free.pop() ?? this.factory();
    if (this.reset) this.reset(obj);
    return obj;
  }

  /** Return an object for reuse. Never `new` again. */
  release(obj: T): void {
    this.free.push(obj);
  }

  /** Count currently available (debug/inspection). */
  get freeCount(): number {
    return this.free.length;
  }
}

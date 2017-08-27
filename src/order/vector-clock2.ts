import {Orderer} from './orderer'

type ReduceFunc<R,T> = (aggregator: R, item: T) => R

interface Tuple<A,B> {
  result: A
  value: B
}

interface SortedSet<T> {
  add(item: T): Tuple<SortedSet<T>,T>
  remove(item: T): Tuple<SortedSet<T>,T>
  union(b: SortedSet<T>): SortedSet<T>
  intersect(b: SortedSet<T>): SortedSet<T>
  difference(b: SortedSet<T>): SortedSet<T>
  reduce<R>(fn: ReduceFunc<R,T>, aggregator: R): R
  mempty(): SortedSet<T>
}

type Key = string
type Version = number;

export class Id {
  constructor(public key: Key, public version: Version) {
    this.key = key;
    this.version = version;
  }

  next(): Id {
    return new Id(
      this.key,
      this.version + 1
    );
  }

  compare(b: Id): number {
    return this.key.localeCompare(b.key);
  }

  toString(): string {
    return `Id(${this.key},${this.version})`
  }
}

export class VectorClock2 implements Orderer<VectorClock2>{
  constructor(public id: Id, public vector: SortedSet<Id>) {
    this.id = id;
    let {result, value} = vector.add(id);

    if (result === vector) {
      if (id.version > value.version) {
        result = vector.remove(id).result.add(id).result;
      }
    }

    this.vector = result;
  }

  toString(): string {
    const a = this.vector.reduce((r, i) => r + i.toString(), '')
    return `VectorClock2(${this.id},${a})`;
  }

  next(): VectorClock2 {
    return new VectorClock2(
      this.id.next(),
      this.vector.remove(this.id).result.add(this.id.next()).result
    );
  }

  equal(b: VectorClock2): boolean {
    return this.compare(b) === 0;
  }

  compare(b: VectorClock2): number {
    return this.vector
      .intersect(b.vector)
      .reduce((cmp, item) => {
        if (cmp === -1) {
          return cmp;
        }

        const rA = this.vector.add(item);
        const rB = b.vector.add(item);

        cmp = rA.value.version - rB.value.version;

        return cmp;
      }, 0);
  }

  merge(b: VectorClock2): VectorClock2 {
    const c = this.vector
      .union(b.vector)
      .reduce(({result, prev}, item) => {
        if (prev) {
          if (prev.key !== item.key) {
            result = result.add(prev).result;
          } else if (prev.version > item.version ) {
            item = prev;
          }
        }

        return {result, prev: item}
      }, {
        result: this.vector.mempty(),
        prev: null,
      });

    return new VectorClock2(
      this.id,
      c.result.add(c.prev).result
    );
  }
}
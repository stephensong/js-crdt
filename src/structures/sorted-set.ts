import {compare, equal} from '../functions'

interface Item<T> {
  compare(b: Item<T>): number
}

type Tree<T extends Item<T>> = Leaf<T> | Branch<T>;
type ReduceFunc<T extends Item<T>,R> = (aggregator: R, leaf: Leaf<T>) => R;

class Leaf<T extends Item<T>>{
  value: T
  constructor(value: T) {
    this.value = value;
  }

  get leaf(): Leaf<T> {
    return this;
  }

  get left(): Tree<T> {
    return null;
  }

  get right(): Tree<T> {
    return null;
  }

  find(fn: (T) => boolean): T {
    if (fn(this.value)) {
      return this.value;
    }
  }

  add(item: T) : Tree<T> {
    const cmp = this.value.compare(item);
    if (cmp === 0) {
      return this;
    } else if (cmp < 0) {
      return new Branch(new Leaf(item), this);
    } else if (cmp > 0) {
      return new Branch(this, null, new Leaf(item));
    }
  }

  reduce<R>(fn: ReduceFunc<T,R>, base: R): R {
    return fn(base, this);
  }
}

class Branch<T extends Item<T>>{
  leaf: Leaf<T>
  left?: Tree<T>
  right?: Tree<T>
  constructor(leaf: Leaf<T>, left?: Tree<T>, right?: Tree<T>) {
    this.leaf = leaf;
    this.left = left;
    this.right = right;
  }
  find(fn: (T) => boolean): T {
    if (fn(this.leaf.value)) {
      return this.leaf.value;
    }

    if (this.left) {
      const fl = this.left.find(fn);
      if (fl) return fl;
    }

    if (this.right) {
      const fr = this.right.find(fn);
      if (fr) return fr;
    }
  }


  add(item: T) : Tree<T> {
    const cmp = this.leaf.value.compare(item);
    if (cmp === 0) {
      return this;
    } else if (cmp < 0) {
      if (this.right) {
        return this.left
          ? new Branch(this.leaf, this.left.add(item), this.right)
          : new Branch(this.leaf, new Leaf(item), this.right);
      } else {
        return this.left
          ? new Branch(new Leaf(item), this.left.left, this.leaf)
          : new Branch(new Leaf(item), this.leaf, null);
      }
    } else if (cmp > 0) {
      if (this.left) {
        return this.right
          ? new Branch(this.leaf, this.left, this.right.add(item))
          : new Branch(this.leaf, this.left, new Leaf(item));
      } else {
        return this.right
          ? new Branch(new Leaf(item), this.leaf, this.right.right)
          : new Branch(new Leaf(item), null, this.leaf)
      }
    }
  }

  reduce<R>(fn: ReduceFunc<T,R>, base: R): R {
    base = fn(base, this.leaf)
    if (this.left) {
      base = this.left.reduce(fn, base);
    }

    if (this.right) {
      base = this.right.reduce(fn, base);
    }

    return base;
  }
}

/*
      +b   +c          +d     +e       +f

   a    b    c       c      d      e         f
       /    /       / \    /      / \      /   \
      a    b       a   b  c      c   d    c     e
          /              / \    / \      / \   /
         a              a   b  a   b    a   b d
*/

interface Set<T> {
  add(item: T): number
  // disjoin(b: Set<T>): Set<T>
  reduce<Y>(fn: (Y, T, number) => Y, accumulator: Y): Y
  index(index: number): T
}

export class SortedSet<T extends Item<T>> implements Set<T> {
  elements: any

  constructor() {
    this.elements = [];
  }

  add(value: T): number {
    let index = this.elements.findIndex(({item}) => {
      return item.equal(value)
    });

    if (-1 === index) {
      index = this.elements.length;
      this.elements.push({item: value, index});
      this.elements.sort((a, b) => compare(a.item, b.item))
    }

    return index;
  }

  index(idx: number): T {
    const item = this.elements.find(({index}) => index === idx);
    if (item) {
      return item.item
    }
  }

  reduce<Y>(fn: (Y, T, number) => Y, accumulator: Y): Y {
    return this.elements.reduce((accumulator, {item, index}) => {
      return fn(accumulator, item, index);
    }, accumulator);
  }
}

function increment(value: number): number {
  return value + 1;
}

export class Indexed<T extends Item<T>> implements Item<T> {
  value: T
  index: number

  constructor(value: T, index: number) {
    this.value = value;
    this.index = index;
  }

  compare(b: Indexed<T>): number  {
    return this.value.compare(b.value);
  }
}

export class SortedSetFast<T extends Item<T>> implements Set<T> {
  elements?: Tree<Indexed<T>>
  count: number

  constructor() {
    this.count = 0;
  }

  get length(): number {
    return this.reduce(increment, 0);
  }

  add(value: T): number {
    const val = new Indexed(value, this.count);
    if (!this.elements) {
      this.elements = new Leaf(val);
    } else {
      this.elements = this.elements.add(val);
      if (this.length > this.count) {
        this.count++;
      }
    }

    val.index = this.count;

    return this.count;
  }

  index(idx: number): T {
    return this.elements
      ? this.elements.find(({index}) => index === idx).value
      : null;
  }

  reduce<Y>(fn: (Y, T, number) => Y, accumulator: Y): Y {
    if (!this.elements) {
      return accumulator;
    }

    return this.elements.reduce((accumulator, item) => {
      return fn(accumulator, item.value, item.value.index);
    }, accumulator);
  }
}

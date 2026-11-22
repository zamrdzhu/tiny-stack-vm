// tiny-stack-vm: an interpreter for make.fun's tiny stack ISA v1. One run
// answers every instance under /input/<id>/. Deterministic. Programs are
// decoded once into flat arrays; limits and trap codes follow ISA.md (vm.mjs).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STACK_MAX = 256, CALLS_MAX = 64, MEMORY_WORDS = 256;
const STEP_LIMIT = 1e6, OUTPUT_MAX = 65536;

// Decoded opcodes (not ISA bytes): 0 HALT 1 PUSH8 2 PUSH32 3 POP 4 DUP
// 5 SWAP 6 OVER 7 ROT 8 ADD 9 SUB 10 MUL 11 DIV 12 MOD 13 DIVU 14 MODU
// 15 NEG 16 AND 17 OR 18 XOR 19 NOT 20 SHL 21 SHR 22 SHRU 23 EQ 24 LT
// 25 LTU 26 JMP 27 JZ 28 JNZ 29 CALL 30 RET 31 LOAD 32 STORE 33 PRINT
// 34 PUTC 35 IN 36 EXIT 37 BAD 38 CUT (traps 5 / 9)
const BAD = 37, CUT = 38;

// ISA byte -> decoded opcode (BAD when no opcode names the byte).
const MAP = new Uint8Array(256).fill(BAD);
for (const [a, b, o] of [[0,7,0],[16,22,8],[24,26,16],[28,30,20],[32,34,23],[48,52,26],[64,65,31],[80,83,33]])
  for (let i = a; i <= b; i++) MAP[i] = o + i - a;
MAP[23] = 15; MAP[27] = 19;

// Pops/pushes per decoded opcode, for the stack-bound checks.
const POPS = Uint8Array.from('000112232222222122212222220110012110100', Number);
const PUSHES = Uint8Array.from('011022331111111111111111110000010001000', Number);

// Decode every byte position. arg: PUSH8's byte, PUSH32's word, CALL's or
// a branch's target. nxt: next instruction's address.
function decode(p) {
  const n = p.length;
  const ops = new Uint8Array(n), arg = new Int32Array(n), nxt = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const op = MAP[p[i]];
    const imm = op === 1 ? 1 : op === 2 ? 4 : op >= 26 && op <= 29 ? 2 : 0;
    ops[i] = op;
    nxt[i] = i + 1 + imm;
    if (i + imm >= n) { ops[i] = CUT; continue; } // immediate cut off
    if (imm === 1) arg[i] = (p[i + 1] << 24) >> 24;
    else if (imm === 4) arg[i] = p[i + 1] | (p[i + 2] << 8) | (p[i + 3] << 16) | (p[i + 4] << 24);
    else if (imm === 2) arg[i] = op === 29 ? p[i + 1] | (p[i + 2] << 8) : i + 3 + (((p[i + 1] | (p[i + 2] << 8)) << 16) >> 16);
  }
  return { ops, arg, nxt };
}

// Run one program: output bytes + exit code. Checks in ISA.md's order:
// step limit, pc, opcode, immediate, step count, stack bounds, own traps.
function run(p, inp) {
  const n = p.length;
  const { ops, arg, nxt } = decode(p);
  const D = new Int32Array(STACK_MAX), C = new Int32Array(CALLS_MAX), M = new Int32Array(MEMORY_WORDS);
  const out = new Uint8Array(OUTPUT_MAX);
  let sp = 0, csp = 0, olen = 0, ip = 0, pc = 0, steps = 0;
  const end = (code) => ({ out: out.slice(0, olen), code });
  for (;;) {
    if (steps === STEP_LIMIT) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = ops[pc];
    if (op === BAD) return end(5);
    if (op === CUT) return end(9);
    steps++;
    if (sp < POPS[op]) return end(2);
    if (sp - POPS[op] + PUSHES[op] > STACK_MAX) return end(3);
    const a = arg[pc];
    pc = nxt[pc];
    switch (op) {
      case 0: return end(0);
      case 1: case 2: D[sp++] = a; break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const t = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = t; break; }
      case 15: D[sp - 1] = (-D[sp - 1]) | 0; break; // wraps at INT_MIN
      case 19: D[sp - 1] = ~D[sp - 1]; break;
      case 8: case 9: case 10: case 11: case 12: case 13: case 14: case 16:
      case 17: case 18: case 20: case 21: case 22: case 23: case 24: case 25: {
        const b = D[sp - 1], x = D[sp - 2];
        let r;
        if (op === 8) r = (x + b) | 0;
        else if (op === 9) r = (x - b) | 0;
        else if (op === 10) r = Math.imul(x, b);
        else if (op === 11) { if (b === 0) return end(4); r = x === -2147483648 && b === -1 ? x : (x / b) | 0; }
        else if (op === 12) { if (b === 0) return end(4); r = b === -1 ? 0 : (x % b) | 0; }
        else if (op === 13) { if (b === 0) return end(4); r = Math.floor((x >>> 0) / (b >>> 0)) | 0; }
        else if (op === 14) { if (b === 0) return end(4); r = ((x >>> 0) % (b >>> 0)) | 0; } else if (op === 16) r = x & b;
        else if (op === 17) r = x | b;
        else if (op === 18) r = x ^ b;
        else if (op === 20) r = x << (b & 31);
        else if (op === 21) r = x >> (b & 31);
        else if (op === 22) r = (x >>> (b & 31)) | 0;
        else if (op === 23) r = x === b ? 1 : 0;
        else if (op === 24) r = x < b ? 1 : 0;
        else r = (x >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2;
        D[sp++] = r;
        break;
      }
      case 26: pc = a; break;
      case 27: if (D[--sp] === 0) pc = a; break;
      case 28: if (D[--sp] !== 0) pc = a; break;
      case 29:
        if (csp === CALLS_MAX) return end(7);
        C[csp++] = pc; pc = a; // pc is already the next instruction's address
        break;
      case 30:
        if (csp === 0) return end(8);
        pc = C[--csp];
        break;
      case 31: {
        const addr = D[sp - 1];
        if (addr < 0 || addr >= MEMORY_WORDS) return end(6);
        D[sp - 1] = M[addr];
        break;
      }
      case 32: {
        const addr = D[sp - 1];
        if (addr < 0 || addr >= MEMORY_WORDS) return end(6);
        const v = D[sp - 2]; sp -= 2; M[addr] = v;
        break;
      }
      case 33: {
        const s = String(D[sp - 1]);
        if (olen + s.length > OUTPUT_MAX) return end(11);
        sp--;
        for (let i = 0; i < s.length; i++) out[olen++] = s.charCodeAt(i);
        break;
      }
      case 34:
        if (olen + 1 > OUTPUT_MAX) return end(11);
        out[olen++] = D[--sp] & 255;
        break;
      case 35: D[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 36: return end(D[--sp] & 255);
      default: return end(5); // unreachable: BAD / CUT are caught above
    }
  }
}

// Answer every instance in the input directory.
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(readFileSync(join(I, id, 'program.bin')), readFileSync(join(I, id, 'input.bin')));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out);
  writeFileSync(join(O, id, 'exit.txt'), `${r.code}\n`);
}

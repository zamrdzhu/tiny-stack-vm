# tiny-stack-vm

[![make.fun](https://img.shields.io/badge/make.fun-bounty-blue)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)

A tiny stack virtual machine for make.fun's tiny stack ISA (version 1): 32-bit wrapping integers, a 256-value stack, branches and calls, 256 words of memory, input/output, and ten traps with their own exit codes.

Run it with `node main.ts`: it answers every instance under `/input/<id>/`, writing `/output/<id>/stdout.bin` and `/output/<id>/exit.txt` for each.

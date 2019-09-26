import { readFileSync, writeFileSync } from 'fs';

let contents : string = readFileSync('data/opcodes.csv', 'utf-8');

let myArray = contents.split("\n").map(row => row.split(";"));

writeFileSync('data/opcodes.txt', JSON.stringify(myArray, null, 2));
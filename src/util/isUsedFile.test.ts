import { Project } from 'ts-morph';
import { isUsedFile } from './isUsedFile.js';
import { IGNORE_COMMENT } from './shouldIgnore.js';

describe('isUsedFile', () => {
  it('should return true if some exports are used in some other file', () => {
    const project = new Project({
      tsConfigFilePath: './tsconfig.json',
    });

    project.createSourceFile(
      './a.ts',
      `import { b } from './b'; import { c } from './c'; import { D } from './d'; import { E } from './e'; console.log(hello, c); let d: D; let e: E;`,
    );

    const b = project.createSourceFile(
      './b.ts',
      `export function b() {}; export const c = 1; export type D = number; export interface E {};`,
    );

    const c = project.createSourceFile(
      './c.ts',
      `export function b() {}; export const c = 1; export type D = number; export interface E {};`,
    );

    const d = project.createSourceFile(
      './d.ts',
      `export function b() {}; export const c = 1; export type D = number; export interface E {};`,
    );

    const e = project.createSourceFile(
      './e.ts',
      `export function b() {}; export const c = 1; export type D = number; export interface E {};`,
    );

    expect(isUsedFile(b)).toBe(true);
    expect(isUsedFile(c)).toBe(true);
    expect(isUsedFile(d)).toBe(true);
    expect(isUsedFile(e)).toBe(true);
  });

  it('should return false if all exports are not used in any other file', () => {
    const project = new Project({
      tsConfigFilePath: './tsconfig.json',
    });

    const b = project.createSourceFile(
      './b.ts',
      `export function b() {}; export const c = 1; export type D = number; export interface E {};`,
    );

    expect(isUsedFile(b)).toBe(false);
  });

  it('should return true if some exports are marked with a skip comment', () => {
    const project = new Project({
      tsConfigFilePath: './tsconfig.json',
    });

    const b = project.createSourceFile(
      './b.ts',
      `// ${IGNORE_COMMENT}
      export function b() {}; export const c = 1; export type D = number; export interface E {};`,
    );

    const c = project.createSourceFile(
      './c.ts',
      `export function b() {};
      // ${IGNORE_COMMENT}
      export const c = 1; export type D = number; export interface E {};`,
    );

    const d = project.createSourceFile(
      './d.ts',
      `export function b() {}; export const c = 1;
      // ${IGNORE_COMMENT}
      export type D = number; export interface E {};`,
    );

    const e = project.createSourceFile(
      './e.ts',
      `export function b() {}; export const c = 1; export type D = number;
      // ${IGNORE_COMMENT}
      export interface E {};`,
    );

    expect(isUsedFile(b)).toBe(true);
    expect(isUsedFile(c)).toBe(true);
    expect(isUsedFile(d)).toBe(true);
    expect(isUsedFile(e)).toBe(true);
  });

  it('should return true if the file has a default export', () => {
    const project = new Project({
      tsConfigFilePath: './tsconfig.json',
    });

    const b = project.createSourceFile(
      './b.ts',
      `export default function b() {}; export const c = 1; export type D = number; export interface E {};`,
    );

    const bAlt = project.createSourceFile(
      './bAlt.ts',
      `function b() {}; export const c = 1; export type D = number; export interface E {}; export default b;`,
    );

    const c = project.createSourceFile(
      './c.ts',
      `export function b() {}; const c = 1; export type D = number; export interface E {}; export default c;`,
    );

    const d = project.createSourceFile(
      './d.ts',
      `export function b() {}; export const c = 1; type D = number; export interface E {}; export default D;`,
    );

    const e = project.createSourceFile(
      './e.ts',
      `export function b() {}; export const c = 1; export type D = number; export default interface E {};`,
    );

    const eAlt = project.createSourceFile(
      './eAlt.ts',
      `function b() {}; export const c = 1; export type D = number; interface E {}; export default E;`,
    );

    expect(isUsedFile(b)).toBe(true);
    expect(isUsedFile(bAlt)).toBe(true);
    expect(isUsedFile(c)).toBe(true);
    expect(isUsedFile(d)).toBe(true);
    expect(isUsedFile(e)).toBe(true);
    expect(isUsedFile(eAlt)).toBe(true);
  });
});

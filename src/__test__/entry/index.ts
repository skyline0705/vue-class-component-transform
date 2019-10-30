import { getTypeAndStruct } from '../../entry';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from '@babel/parser';
import { parseOptions } from '../../const';
import {
    ExportDefaultDeclaration,
    isObjectExpression,
    isExportDefaultDeclaration,
    isClassDeclaration,
} from '@babel/types';
describe('Get declareType', () => {
    test('It should be an Object-Based struct when not use "Vue.extend"', () => {
        const code = readFileSync(resolve(__dirname, './object-based-code-1.ts')).toString('utf-8');
        const ast = parse(code, parseOptions);
        const exportDefaultDeclaration = ast.program.body
            .find(node => isExportDefaultDeclaration(node)) as ExportDefaultDeclaration;
        const { type, struct } = getTypeAndStruct(exportDefaultDeclaration);
        expect(type).toBe('objectBased');
        expect(isObjectExpression(struct)).toBe(true);
    });
    test('It should be an Object-Based struct when use "Vue.extend"', () => {
        const code = readFileSync(resolve(__dirname, './object-based-code-2.ts')).toString('utf-8');
        const ast = parse(code, parseOptions);
        const exportDefaultDeclaration = ast.program.body
            .find(node => isExportDefaultDeclaration(node)) as ExportDefaultDeclaration
        const { type, struct } = getTypeAndStruct(exportDefaultDeclaration);
        expect(type).toBe('objectBased');
        expect(isObjectExpression(struct)).toBe(true);
    });
    test('It should be an Object-Based struct', () => {
        const code = readFileSync(resolve(__dirname, './class-based-code.ts')).toString('utf-8');
        const ast = parse(code, parseOptions);
        const exportDefaultDeclaration = ast.program.body
            .find(node => isExportDefaultDeclaration(node)) as ExportDefaultDeclaration
        const { type, struct } = getTypeAndStruct(exportDefaultDeclaration);
        expect(type).toBe('classBased');
        expect(isClassDeclaration(struct)).toBe(true);
    });
    test('It should not support', () => {
        const code = readFileSync(resolve(__dirname, './not-support-code.ts')).toString('utf-8');
        const ast = parse(code, parseOptions);
        const exportDefaultDeclaration = ast.program.body
            .find(node => isExportDefaultDeclaration(node)) as ExportDefaultDeclaration
        try {
            getTypeAndStruct(exportDefaultDeclaration)
        } catch (e) {
            expect(e).toEqual(new Error('Not support your input code'));
        }
    })
});
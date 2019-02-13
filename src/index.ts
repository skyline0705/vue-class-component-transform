import { resolve } from 'path';
import { readFileSync } from 'fs';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import { vueClassComponentImport } from './consts';
import {
    ExportDefaultDeclaration,
    ClassDeclaration,
    ObjectExpression,
    ObjectProperty,
    SpreadElement,
    ObjectMethod,
    ArrayExpression,
    Identifier,
    ImportDeclaration,
} from '@babel/types';
// const filePath = process.argv.slice(2)[0];
// const fileFullPath = resolve(__dirname, filePath);
const fileFullPath = resolve(__dirname, '../examples/abc.js');
const file = readFileSync(fileFullPath).toString('utf-8');



const outputFullpath = resolve(__dirname, '../examples/abc.ts');
const outputFile = readFileSync(outputFullpath).toString('utf-8');
// @ts-ignore
const outputAst = parse(outputFile, {
    sourceType: 'module',
    plugins: [
        [ 'decorators', {decoratorsBeforeExport: true }],
        'classProperties',
        'typescript',
    ]
});

const outputExportDefaultDeclaration = outputAst.program.body.find(node => node.type === 'ExportDefaultDeclaration')  as ExportDefaultDeclaration;;





// @ts-ignore
const ast = parse(file, {
    sourceType: 'module',
    plugins: [
        [ 'decorators', {decoratorsBeforeExport: true }],
        'classProperties',
    ]
});

function generateSuperClass(mixins: ArrayExpression | null) {
    if (mixins === null) {
        return {
            type: 'Identifier',
            name: 'Vue',
        };
    }
    return {
        type: 'CallExpression',
        callee: {
            type: 'Identifier',
            name: 'Mixins',
        },
        arguments: mixins.elements,
    };
}

function getMixins(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
    const mixinIndex = objProperties.findIndex(prop => {
        return prop.type === 'ObjectProperty'
            && prop.key.name == 'mixins';
    });
    if (mixinIndex === -1) {
        return null;
    }
    const mixins = objProperties.splice(
        mixinIndex,
        1,
    )[0];

    const elements = ((mixins as ObjectProperty).value as ArrayExpression).elements.map(element => {
        return {
            type: 'Identifier',
            name: (element as Identifier).name,
        };
    });
    return {
        type: 'ArrayExpression',
        elements,
    } as ArrayExpression;
}

function transformObjectBasedComponentToClass(node: ExportDefaultDeclaration) {
    const objProperties = (node.declaration as ObjectExpression).properties;
    // 此处为了挂载class component方便，所以对原有properties做mutable操作
    const mixin = getMixins(objProperties);
    const exportValue = {
        type: 'ExportDefaultDeclaration',
        declaration: {
            type: 'ClassDeclaration',
            decorators: [{
                type: 'Decorator',
                expression: {
                    type: 'CallExpression',
                    callee: {
                        type: 'Identifier',
                        name: 'Component',
                    },
                }
            }],
            id: {
                type: 'Identifier',
                name: 'LiveDetail'
            },
            superClass: generateSuperClass(mixin),
        } as ClassDeclaration,
    } as ExportDefaultDeclaration;
    return exportValue;
}

const exportDefaultDeclarationIndex = ast.program.body.findIndex(node => node.type === 'ExportDefaultDeclaration');
ast.program.body[exportDefaultDeclarationIndex] = transformObjectBasedComponentToClass(ast.program.body[exportDefaultDeclarationIndex] as ExportDefaultDeclaration);
// 全局那一堆import
// @ts-ignore
ast.program.body.unshift(vueClassComponentImport);
const output = generate(ast, {
    // 隐藏属性……先这么用着
    // @ts-ignore
    decoratorsBeforeExport: true,
});
console.log(output.code);
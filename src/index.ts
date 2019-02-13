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
    CallExpression,
    Expression,
    StringLiteral,
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

function getMixins(mixins: ObjectProperty | null) {
    if (mixins === null) {
        return null;
    }
    const elements = (mixins.value as ArrayExpression).elements.map(element => {
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

function getProp(type: string, objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
    const index = objProperties.findIndex(prop => {
        return prop.type === 'ObjectProperty'
            && prop.key.name === type;
    });
    if (index === -1) {
        return null;
    }
    return objProperties.splice(
        index,
        1,
    )[0] as ObjectProperty;
}

function getComponentArguments(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
    const components = getProp('components', objProperties);
    const directives = getProp('directives', objProperties);
    const watch = getProp('watch', objProperties);
    if (!components && !directives && !watch) {
        return null;
    }
    return [{
        type: 'ObjectExpression',
        properties: [components, directives, watch]
            .filter(item => !!item)
            .map(item => {
                return {
                    type: (item as ObjectProperty).type,
                    value: (item as ObjectProperty).value,
                    key: (item as ObjectProperty).key,
                };
            })
    }] as Expression[];
}

function generateComponentDecorator(componentArguments: Expression[] | null) {
    if (componentArguments === null) {
        return {
            type: 'Identifier',
            name: 'Component',
        };
    }
    return {
        type: 'CallExpression',
        callee: {
            type: 'Identifier',
            name: 'Component',
        },
        arguments: componentArguments,
    } as CallExpression
}
function kebabCase2PascalCase(name: string) {
    return name.slice(0, 1).toUpperCase()
        + name.replace(/-([a-z])/g, g => g[1].toUpperCase()).slice(1);
}

function generateName(name: string) {
    if (!name.includes('/')) {
        return kebabCase2PascalCase(name);
    }
    const lastSlashIndex = name.lastIndexOf('/');
    const lastDotIndex = name.lastIndexOf('.');
    return kebabCase2PascalCase(name.slice(lastSlashIndex + 1, lastDotIndex));
}

function transformObjectBasedComponentToClass(node: ExportDefaultDeclaration) {
    const objProperties = (node.declaration as ObjectExpression).properties;
    // 此处为了挂载class component方便，所以对原有properties做mutable操作
    const mixins = getMixins(getProp('mixins', objProperties));
    const componentArguments = getComponentArguments(objProperties);
    const nameProperty = getProp('name', objProperties);
    const name = nameProperty && (nameProperty.value as StringLiteral).value
        || fileFullPath;

    const exportValue = {
        type: 'ExportDefaultDeclaration',
        declaration: {
            type: 'ClassDeclaration',
            decorators: [{
                type: 'Decorator',
                expression: generateComponentDecorator(componentArguments),
            }],
            id: {
                type: 'Identifier',
                name: generateName(name),
            },
            superClass: generateSuperClass(mixins),
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
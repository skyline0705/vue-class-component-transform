import { readFileSync, writeFileSync } from 'fs';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
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
    ReturnStatement,
    ClassProperty,
    ClassMethod,
    FunctionExpression,
    isExportDefaultDeclaration,
    isObjectExpression,
    isCallExpression,
    isMemberExpression,
    isIdentifier,
    isDeclareClass,
    isClassDeclaration,
} from '@babel/types';
import { parseOptions } from './const';

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

function getProp(
    type: string,
    objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[],
) {
    const index = objProperties.findIndex(prop => {
        if (prop.type === 'SpreadElement') {
            throw new Error(`Get prop not support type ${prop.type}`);
        }
        return prop.key.name === type;
    });
    if (index === -1) {
        return null;
    }
    return objProperties.splice(
        index,
        1,
    )[0] as ObjectProperty | ObjectMethod;
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

function transformProps(props: ObjectProperty) {
    const body = props.value;
    if (body.type !== 'ObjectExpression') {
        throw new Error('Transform Props only support Object Expression Props');
    }
    const properties = body.properties;
    return properties.map(prop => {
        return {
            type: 'ClassProperty',
            decorators: [{
                type: 'Decorator',
                expression: {
                    type: 'CallExpression',
                    callee: {
                        type: 'Identifier',
                        name: 'Prop'
                    },
                    arguments: [(prop as ObjectProperty).value]
                }
            }],
            static: false,
            key: (prop as ObjectProperty).key,
            value: null,
        } as ClassProperty;
    });
}

function transformData(data: ObjectMethod) {
    const nodes = data.body.body;
    if (nodes.some(node => node.type !== 'ReturnStatement')) {
        throw new Error('Data Block should has local statement!');
    }
    const node = (nodes[0] as ReturnStatement).argument as ObjectExpression;
    if (node.type !== 'ObjectExpression') {
        throw new Error('Return value should be an ObjectExpression');
    }
    return transformToClassBodyProp(node, 'ClassProperty');
}

const transformPropCallBackMap = {
    ClassProperty(item: ObjectProperty | ObjectMethod | SpreadElement) {
        if (item.type !== 'ObjectProperty') {
            throw new Error(`Transform data error, type '${item.type}' is not support`);
        }
        return {
            type: 'ClassProperty',
            static: false,
            key: (item as ObjectProperty).key,
            computed: false,
            value: {
                ...(item as ObjectProperty).value,
            }
        } as ClassProperty;
    },
    ClassMethod(item: ObjectProperty | ObjectMethod | SpreadElement) {
        if (item.type !== 'ObjectMethod') {
            throw new Error(`Transform methods error, type '${item.type}' is not support`);
        }
        return {
            type: 'ClassMethod',
            static: false,
            key: (item as ObjectMethod).key,
            computed: false,
            kind: 'method',
            generator: (item as ObjectMethod).generator,
            async: (item as ObjectMethod).async,
            params: (item as ObjectMethod).params,
            body: (item as ObjectMethod).body,
        } as ClassMethod;
    },
    ClassAccessProperty(item: ObjectProperty | ObjectMethod | SpreadElement) {
        if (item.type === 'SpreadElement') {
            throw new Error(`Transform computed error, type '${item.type}' is not support`);
        }
        const common = {
            type: 'ClassMethod',
            static: false,
            key: (item as ObjectMethod).key,
            computed: false,
        }
        if (item.type === 'ObjectMethod') {
            return {
                ...common,
                generator: (item as ObjectMethod).generator,
                async: (item as ObjectMethod).async,
                kind: 'get',
                params: (item as ObjectMethod).params,
                body: (item as ObjectMethod).body,
            } as ClassMethod;
        }
        const properties = (item.value as ObjectExpression).properties.map(item => {
            return {
                ...common,
                generator: (item as ObjectMethod).generator,
                async: (item as ObjectMethod).async,
                kind: (item as ObjectMethod | ObjectProperty).key.name,
                params: (item as ObjectMethod).params
                || ((item as ObjectProperty).value as FunctionExpression).params,
                body: (item as ObjectMethod).body
                    || ((item as ObjectProperty).value as FunctionExpression).body,
            } as ClassMethod;
        });
        return properties;
    }
}

function transformToClassBodyProp(
    node: ObjectExpression,
    type: 'ClassProperty' | 'ClassMethod',
    isAccessProp?: boolean
) {
    if (type === 'ClassMethod' && isAccessProp) {
        return node.properties.map(item => {
            return transformPropCallBackMap.ClassAccessProperty(item);
        }).reduce((list: ClassMethod[], item) => {
            return Array.isArray(item)
                ? [...list, ...item]
                : [...list, item];
        }, [] as ClassMethod[]);
    }
    return node.properties.map(item => {
        return transformPropCallBackMap[type](item);
    });
}

const transformPropsMap = {
    props(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
        const props = getProp('props', objProperties);
        if (!props) {
            return [];
        }
        if (props.type !== 'ObjectProperty') {
            throw new Error('Transform Props only support Object Expression Props')
        }
        return transformProps(props);
    },
    metaInfo(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
        const metaInfo = getProp('metaInfo', objProperties);
        if (!metaInfo) {
            return []
        }
        return [{
            ...metaInfo,
            type: metaInfo.type === 'ObjectProperty'
                ? 'ClassProperty'
                : 'ClassMethod',
            decorators: [{
                type: 'Decorator',
                expression: {
                    type: 'Identifier',
                    name: 'Meta'
                }
            }],
        } as ClassMethod | ClassProperty];
    },
    inject(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
        const inject = getProp('inject', objProperties);
        if (!inject) {
            return []
        }
        if (inject.type !== 'ObjectProperty') {
            throw new Error(`Transform inject error, type '${inject.type}' is not support`)
        }
        const elements = (inject.value as ArrayExpression).elements as StringLiteral[];
        if (!elements.length) {
            return [];
        }
        return elements.map(element => {
            return {
                type: 'ClassProperty',
                decorators: [{
                    type: 'Decorator',
                    expression: {
                        type: 'CallExpression',
                        callee: {
                            type: 'Identifier',
                            name: 'Inject'
                        },
                        arguments: [] as Expression[]
                    }
                }],
                static: false,
                key: {
                    type: 'Identifier',
                    name: element.value,
                },
                value: null,
            } as ClassProperty;
        });
    },
    models(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
        const models = getProp('models', objProperties);
        if (!models) {
            return []
        }
        if (models.type !== 'ObjectProperty') {
            throw new Error(`Transform models error, type '${models.type}' is not support`)
        }
        return [{
            type: 'ClassProperty',
            decorators: [{
                type: 'Decorator',
                expression: {
                    type: 'CallExpression',
                    callee: {
                        type: 'Identifier',
                        name: 'Models'
                    },
                    arguments: [(models as ObjectProperty).value],
                }
            }],
            static: false,
            key: {
                type: 'Identifier',
                name: '$models',
            },
            value: null,
        } as ClassProperty];
    },
    data(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
        const data = getProp('data', objProperties);
        if (!data) {
            return [];
        }
        if (data.type === 'ObjectProperty') {
            throw new Error('Transform Data don\'t support Object Expression Data')
        }
        return transformData(data);
    },
    methods(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
        const methods = getProp('methods', objProperties);
        if (!methods) {
            return [];
        }
        return transformToClassBodyProp(
            (methods as ObjectProperty).value as ObjectExpression,
            'ClassMethod'
        );
    },
    computed(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
        const computed = getProp('computed', objProperties);
        if (!computed) {
            return [];
        }
        return transformToClassBodyProp(
            (computed as ObjectProperty).value as ObjectExpression,
            'ClassMethod',
            true,
        );
    },
}

type propType = keyof typeof transformPropsMap;

function transformObjectBasedComponentToClass(node: ExportDefaultDeclaration, input: string) {
    const objProperties = (node.declaration as ObjectExpression).properties;
    // 此处为了挂载class component方便，所以对原有properties做mutable操作
    const mixins = getMixins(getProp('mixins', objProperties) as ObjectProperty);
    const componentArguments = getComponentArguments(objProperties);
    const nameProperty = getProp('name', objProperties)  as ObjectProperty;
    const name = nameProperty && (nameProperty.value as StringLiteral).value
        || input;

    const properties = Object.keys(transformPropsMap).map(key => {
        return transformPropsMap[key as propType](objProperties);
    }).reduce((prev, next) => [...prev, ...next]);
    const otherProperties = objProperties.map(prop => {
        // @ts-ignore
        return {
            ...prop,
            type: prop.type === 'ObjectProperty'
            ? 'ClassProperty'
            : 'ClassMethod',
            typeAnnotation: null,
            abstract: null,
            accessibility: null,
            definite: null,
            optional: null,
            readonly: null,
            static: null,
        }  as ClassProperty;
    });

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
            body: {
                type: 'ClassBody',
                body: [...properties, ...otherProperties],
            }
        } as ClassDeclaration,
    } as ExportDefaultDeclaration;
    return exportValue;
}
compileToComposition('./examples/class.vue');

type TypeAndStruct = {
    type: 'objectBased';
    struct: ObjectExpression;
} | {
    type: 'classBased';
    struct: ClassDeclaration;
}

export function getTypeAndStruct(exportDefaultDeclartion: ExportDefaultDeclaration) {
    const declaration = exportDefaultDeclartion.declaration;
    if (isObjectExpression(declaration)) {
        return {
            type: 'objectBased',
            struct: declaration,
        } as TypeAndStruct;
    }
    if (
        isCallExpression(declaration)
        && isMemberExpression(declaration.callee)
        && isIdentifier(declaration.callee.property)
        && declaration.callee.property.name === 'extend'
        && isObjectExpression(declaration.arguments[0])
    ) {
        return {
            type: 'objectBased',
            struct: declaration.arguments[0],
        } as TypeAndStruct;
    } else if (isClassDeclaration(declaration)) {
        return {
            type: 'classBased',
            struct: declaration,
        }
    }
    throw new Error('Not support your input code');
}

export function compileToComposition(inputResource: string, outputPath: string = inputResource) {
    const file = readFileSync(inputResource).toString('utf-8');
    const scriptIndex = file.indexOf('<script');
    const isVue = scriptIndex !== -1;
    let input = file;
    let start = '';
    let end = '';
    if (isVue) {
        const scriptEndIndex = file.lastIndexOf('</script>');
        start = file.slice(0, scriptIndex);
        end = file.slice(scriptEndIndex);
        input = file.slice(start.length, file.indexOf(end));
        const index = input.indexOf('>') + 1;
        start += input.slice(0, index);
        input = input.slice(index);
    }
    const ast = parse(input, parseOptions);

    const exportDefaultDeclarationIndex = ast.program.body.findIndex(node => isExportDefaultDeclaration(node));
    const exportDefaultDeclaration = ast.program.body[exportDefaultDeclarationIndex] as ExportDefaultDeclaration;
    const beforeAsts = ast.program.body.splice(0, exportDefaultDeclarationIndex);
    const afterAsts = ast.program.body.splice(exportDefaultDeclarationIndex);
    // const { type, struct } = getTypeAndStruct(exportDefaultDeclaration);
    // ast.program.body[exportDefaultDeclarationIndex] = transformObjectBasedComponentToClass(
    //     inputResource,
    // );
    // 全局那一堆import
    // ast.program.body.unshift(vueClassComponentImport);
    // const result = generate(ast, {
    //     decoratorsBeforeExport: true,
    // });
    // writeFileSync(outputPath, `${start}\n${result.code}\n${end}`);
}
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const parser_1 = require("@babel/parser");
const generator_1 = __importDefault(require("@babel/generator"));
const consts_1 = require("./consts");
function generateSuperClass(mixins) {
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
function getMixins(mixins) {
    if (mixins === null) {
        return null;
    }
    const elements = mixins.value.elements.map(element => {
        return {
            type: 'Identifier',
            name: element.name,
        };
    });
    return {
        type: 'ArrayExpression',
        elements,
    };
}
function getProp(type, objProperties) {
    const index = objProperties.findIndex(prop => {
        if (prop.type === 'SpreadElement') {
            throw new Error(`Get prop not support type ${prop.type}`);
        }
        return prop.key.name === type;
    });
    if (index === -1) {
        return null;
    }
    return objProperties.splice(index, 1)[0];
}
function getComponentArguments(objProperties) {
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
                    type: item.type,
                    value: item.value,
                    key: item.key,
                };
            })
        }];
}
function generateComponentDecorator(componentArguments) {
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
    };
}
function kebabCase2PascalCase(name) {
    return name.slice(0, 1).toUpperCase()
        + name.replace(/-([a-z])/g, g => g[1].toUpperCase()).slice(1);
}
function generateName(name) {
    if (!name.includes('/')) {
        return kebabCase2PascalCase(name);
    }
    const lastSlashIndex = name.lastIndexOf('/');
    const lastDotIndex = name.lastIndexOf('.');
    return kebabCase2PascalCase(name.slice(lastSlashIndex + 1, lastDotIndex));
}
function transformData(data) {
    const nodes = data.body.body;
    if (nodes.some(node => node.type !== 'ReturnStatement')) {
        throw new Error('Data Block should has local statement!');
    }
    const node = nodes[0].argument;
    if (node.type !== 'ObjectExpression') {
        throw new Error('Return value should be an ObjectExpression');
    }
    return transformToClassBodyProp(node, 'ClassProperty');
}
const transformPropCallBackMap = {
    ClassProperty(item) {
        if (item.type !== 'ObjectProperty') {
            throw new Error(`Transform data error, type '${item.type}' is not support`);
        }
        return {
            type: 'ClassProperty',
            static: false,
            key: item.key,
            computed: false,
            value: {
                ...item.value,
            }
        };
    },
    ClassMethod(item) {
        if (item.type !== 'ObjectMethod') {
            throw new Error(`Transform methods error, type '${item.type}' is not support`);
        }
        return {
            type: 'ClassMethod',
            static: false,
            key: item.key,
            computed: false,
            kind: 'method',
            generator: item.generator,
            async: item.async,
            params: item.params,
            body: item.body,
        };
    },
    ClassAccessProperty(item) {
        if (item.type === 'SpreadElement') {
            throw new Error(`Transform computed error, type '${item.type}' is not support`);
        }
        const common = {
            type: 'ClassMethod',
            static: false,
            key: item.key,
            computed: false,
        };
        if (item.type === 'ObjectMethod') {
            return {
                ...common,
                generator: item.generator,
                async: item.async,
                kind: 'get',
                params: item.params,
                body: item.body,
            };
        }
        const properties = item.value.properties.map(item => {
            return {
                ...common,
                generator: item.generator,
                async: item.async,
                kind: item.key.name,
                params: item.params
                    || item.value.params,
                body: item.body
                    || item.value.body,
            };
        });
        return properties;
    }
};
function transformToClassBodyProp(node, type, isAccessProp) {
    if (type === 'ClassMethod' && isAccessProp) {
        return node.properties.map(item => {
            return transformPropCallBackMap.ClassAccessProperty(item);
        }).reduce((list, item) => {
            return Array.isArray(item)
                ? [...list, ...item]
                : [...list, item];
        }, []);
    }
    return node.properties.map(item => {
        return transformPropCallBackMap[type](item);
    });
}
const transformPropsMap = {
    metaInfo(objProperties) {
        const metaInfo = getProp('metaInfo', objProperties);
        if (!metaInfo) {
            return [];
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
            }];
    },
    inject(objProperties) {
        const inject = getProp('inject', objProperties);
        if (!inject) {
            return [];
        }
        if (inject.type !== 'ObjectProperty') {
            throw new Error(`Transform inject error, type '${inject.type}' is not support`);
        }
        const elements = inject.value.elements;
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
                            arguments: []
                        }
                    }],
                static: false,
                key: {
                    type: 'Identifier',
                    name: element.value,
                },
                value: null,
            };
        });
    },
    models(objProperties) {
        const models = getProp('models', objProperties);
        if (!models) {
            return [];
        }
        if (models.type !== 'ObjectProperty') {
            throw new Error(`Transform models error, type '${models.type}' is not support`);
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
                            arguments: [models.value],
                        }
                    }],
                static: false,
                key: {
                    type: 'Identifier',
                    name: '$models',
                },
                value: null,
            }];
    },
    data(objProperties) {
        const data = getProp('data', objProperties);
        if (!data) {
            return [];
        }
        if (data.type === 'ObjectProperty') {
            throw new Error('Transform Data don\'t support Object Expression Data');
        }
        return transformData(data);
    },
    methods(objProperties) {
        const methods = getProp('methods', objProperties);
        if (!methods) {
            return [];
        }
        return transformToClassBodyProp(methods.value, 'ClassMethod');
    },
    computed(objProperties) {
        const computed = getProp('computed', objProperties);
        if (!computed) {
            return [];
        }
        return transformToClassBodyProp(computed.value, 'ClassMethod', true);
    },
};
function transformObjectBasedComponentToClass(node, input) {
    const objProperties = node.declaration.properties;
    // 此处为了挂载class component方便，所以对原有properties做mutable操作
    const mixins = getMixins(getProp('mixins', objProperties));
    const componentArguments = getComponentArguments(objProperties);
    const nameProperty = getProp('name', objProperties);
    const name = nameProperty && nameProperty.value.value
        || input;
    const properties = Object.keys(transformPropsMap).map(key => {
        return transformPropsMap[key](objProperties);
    }).reduce((prev, next) => [...prev, ...next]);
    const otherProperties = objProperties.map(prop => {
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
        };
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
        },
    };
    return exportValue;
}
function transform(inputPath, outputPath = inputPath) {
    const file = fs_1.readFileSync(inputPath).toString('utf-8');
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
    // @ts-ignore
    const ast = parser_1.parse(input, {
        sourceType: 'module',
        plugins: [
            // @ts-ignore
            ['decorators', { decoratorsBeforeExport: true }],
            // @ts-ignore
            'classProperties',
        ]
    });
    const exportDefaultDeclarationIndex = ast.program.body.findIndex(node => node.type === 'ExportDefaultDeclaration');
    ast.program.body[exportDefaultDeclarationIndex] = transformObjectBasedComponentToClass(ast.program.body[exportDefaultDeclarationIndex], inputPath);
    // 全局那一堆import
    // @ts-ignore
    ast.program.body.unshift(consts_1.vueClassComponentImport);
    const result = generator_1.default(ast, {
        // 隐藏属性……先这么用着
        // @ts-ignore
        decoratorsBeforeExport: true,
    });
    fs_1.writeFileSync(outputPath, `${start}\n${result.code}\n${end}`);
}
exports.default = transform;
//# sourceMappingURL=index.js.map
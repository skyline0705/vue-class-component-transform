import { parse } from '@babel/parser';
import generate from '@babel/generator';
describe('collect data', () => {
    let code = `export default Vue.extend({
        data: {
            a: 1,
            b: 2
        },
    })`;
    let ast = parse(code, {
        sourceType: 'module',
    });
    test('data object', () => {
        expect(ast.type).toBe('File');
    });
});
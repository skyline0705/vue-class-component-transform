<template>
    <span>
        <span v-for="(node, index) in contentAst" :key="index">
            <template v-if="node.type === 'plainText'">
                {{ node.value }}
            </template>
            <at-content v-else-if="node.type === 'at'" :at="node.value"> </at-content>
            <template v-if="node.type === 'emoticon'">
                <img
                    :src="node.url"
                    :alt="node.code"
                    class="emoji"
                    :style="emojiStyle"
                />
            </template>
        </span>
    </span>
</template>

<script>
/**
 * @file 处理带有@内容的评论内容
 *
 * @author liupai
 */
import atContent from './at-content';
import { transformContentAST, PROCESSORS } from '@/components/comment/parser';

export default {
    models: ['emoticonModel'],
    props: {
        content: {
            type: String,
            default: '',
        },
        processors: {
            type: Array,
            default() {
                return [PROCESSORS.EMOJI, PROCESSORS.AT];
            },
        },
        emojiStyle: {
            type: Object,
            default: () => ({}),
        },
    },
    computed: {
        contentAst() {
            const processors = this.processors.map(processor => {
                return processor === PROCESSORS.EMOJI ? processor(this.$models.emoticonModel.iconUrls) : processor;
            });
            return transformContentAST(this.content, processors);
        },
    },
    components: {
        atContent,
    },
};
</script>
<style lang="stylus" scoped>
.emoji
    vertical-align: sub
    width: 18px

.danmaku-emoji
    width: 26px
</style>

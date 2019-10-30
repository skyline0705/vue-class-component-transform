import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';

@Component
export default class ScrollViewComponent extends Vue {

    @Prop({ default: false })
    scrollX!: boolean;

    @Prop({ default: false })
    scrollY!: boolean;

    @Prop({ default: 0 })
    upperThreshold!: number;

    @Prop({ default: 0 })
    lowerThreshold!: number;

    @Prop({ default: 0 })
    scrollTop!: number;

    @Prop({ default: 0 })
    scrollLeft!: number; // 设置横向滚动条位置（单位px，2.4.0起支持rpx），我们暂时没有支持属性的 rpx。。 TODO 后面加个 decorator 搞这个转换吧

    @Prop(String)
    scrollIntoView!: string; // 值应为某子元素id（id不能以数字开头）。设置哪个方向可滚动，则在哪个方向滚动到该元素

    @Prop({ default: false })
    scrollWithAnimation!: boolean; // 在设置滚动条位置时使用动画过渡 // TODO 动画相关的暂时都未实现，后面统一找个动画库搞吧

    @Prop({ default: false })
    enableHackToTop!: boolean; // iOS点击顶部状态栏、安卓双击标题栏时，滚动条返回顶部，只支持竖向 // TODO

    updated() {
        console.log('-------------updated ScrollViewComponent-------------');
    }

    mounted() {
        console.log(`scroll-view${this.nodeId}`, this);
        const scrollViewContainer = this.$refs.scrollViewContainer as Element;
        scrollViewContainer.scrollTop += this.scrollTop;
        scrollViewContainer.scrollLeft += this.scrollLeft;
    }

    handleScroll() {
        console.log(`handleScroll${this.nodeId}`);
        const {
            scrollLeft,
            scrollTop,
            scrollHeight,
            scrollWidth,
        } = this.$refs.scrollViewContainer as Element;

        this.$emit('scroll', {
            detail: {
                scrollLeft,
                scrollTop,
                scrollHeight,
                scrollWidth,
            },
        });

        const container = this.$refs.scrollViewContainer as Element;
        const containerHeight = container.clientHeight;
        const containerWidth = container.clientWidth;

        const isToTop = this.scrollY && container.scrollTop - this.upperThreshold <= 1;
        const isToLeft = this.scrollX && container.scrollLeft - this.upperThreshold <= 1;
        const isToBottom = this.scrollY &&
            container.scrollHeight - (containerHeight + container.scrollTop) <= this.lowerThreshold;
        const isToRight = this.scrollX &&
            container.scrollWidth - (containerWidth + container.scrollLeft) <= this.lowerThreshold;

        console.log('handleScroll', isToTop, isToRight, isToBottom, isToLeft, container);
        if (isToTop || isToLeft) {
            isToTop && console.log('scroll at top boundary');
            isToLeft && console.log('scroll at left boundary');

            this.$emit('scrolltoupper');
        }

        if (isToBottom || isToRight) {
            isToBottom && console.log('scroll at bottom boundary');
            isToRight && console.log('scroll at right boundary');
            this.$emit('scrolltolower');
        }
    }
}
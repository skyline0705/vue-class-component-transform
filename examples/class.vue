<template>
<div
    class="container"
    ref="scrollViewContainer"
    @scroll="handleScroll"
    :style="{
        overflowX: scrollX ? 'scroll' : 'hidden',
        overflowY: scrollY ? 'scroll' : 'hidden',
    }"
>
    <slot></slot>
</div>
</template>
<script lang="ts">

</script>
<style lang="stylus" scoped>
.container
    margin 0 auto
    -webkit-overflow-scrolling touch
</style>
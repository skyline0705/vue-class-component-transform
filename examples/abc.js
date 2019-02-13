/**
 * @file PC直播站主页
 *
 * @author 天翔Skyline(skyline0705@gmail.com)
 * 11 Nov 2017
 */
import liveHeader from '@/components/header';
import sidebar from '@/components/sidebar';
import userBannedModal from '@/components/modals/user-banned-modal';
import chat from './chat';
import recommendLiveList from './recommend-live-list';
import livePlayer from './live-player';

import myFollowCount from '@/mixins/my-follow-count';
import overlayScrollbar from '@/pure-components/overlay-scrollbar';
import { keywords } from '@/common/config/seo';
import { waitAllPromiseFinish } from '@/common/util';
import billboard from './billboard';
import { addLiveStreamId, removeLiveStreamId } from '@/common/log/sendLog';
import liveDetailHeader from './header';
import workList from './work-list';
import announcement from './announcement';
import userCard from './user-card';
import playbackList from './playback-list';
import { hasCookie, getCookie } from '@/common/cookie';
import { useFlash } from '@/common/util/player';
import resize from '@/common/directives/resize';

export default {
    name: 'live-detail',
    inject: ['uaInfo'],
    mixins: [myFollowCount],
    metaInfo() {
        const user = this.$models.liveDetailModel.user;
        return {
            title: `${user.name}-快手直播`,
            meta: [
                {
                    name: 'keywords',
                    content: `${keywords},${user.name},${user.id}`,
                },
                {
                    name: 'description',
                    content: `快手直播${user.id}，为您提供精彩直播，${user.description}`,
                },
            ],
        };
    },
    models: ['liveDetailModel', 'feedModel', 'categoryModel', 'profileModel', 'userModel', 'playbackModel'],
    data() {
        return {
            wideMode: false,
        };
    },
    computed: {
        recommendListCountInPlayer() {
            return this.wideMode ? 3 : 2;
        },
        recommendLiveStreamList() {
            return this.$models.liveDetailModel.recommendLiveStreamList;
        },
        moreRecommendList() {
            if (this.$models.feedModel.isLiving) {
                return this.recommendLiveStreamList.slice(0, 8);
            }
            return this.recommendLiveStreamList.slice(
                this.recommendListCountInPlayer,
                this.recommendListCountInPlayer + 8,
            );
        },
        recommendCategoryList() {
            return this.$models.liveDetailModel.recommendCategoryList;
        },
        playbackList() {
            return this.$models.playbackModel.recommendPlaybackList;
        },
        showPlayBackList() {
            return !useFlash(this.uaInfo) && this.playbackList.length;
        },
    },
    methods: {
        changeWideMode(wideMode) {
            this.wideMode = wideMode;
        },
        changeGiftPos() {
            const playerContainer = document.getElementsByClassName('live-detail-player-container')[0];
            if (document.documentElement.clientHeight / document.documentElement.clientWidth < 0.563) {
                playerContainer.style.paddingTop = document.documentElement.clientHeight - 145 + 'px';
            } else {
                playerContainer.style.paddingTop = 'calc(100% / 16 * 9 + 80px)';
            }
        },
    },
    mounted() {
        if (this.$models.userModel.userBannedValue) {
            this.$router.replace({
                name: 'common-error',
                query: {
                    errorCode: '108',
                },
            });
            return;
        }
        addLiveStreamId(this.$models.liveDetailModel.liveStream.liveStreamId);
    },
    beforeDestroy() {
        document.documentElement.classList.remove('live-warpper');
        removeLiveStreamId();
    },
    components: {
        sidebar,
        recommendLiveList,
        chat,
        livePlayer,
        overlayScrollbar,
        billboard,
        liveDetailHeader,
        workList,
        announcement,
        userBannedModal,
        userCard,
        playbackList,
        liveHeader,
    },
    directives: {
        resize,
    },
    watch: {
        '$models.liveDetailModel.liveStream.liveStreamId'(val) {
            addLiveStreamId(val);
        },
        '$models.feedModel.isLiving'(val, oldVal) {
            if (!val && oldVal) {
                // TODO没想好怎么合到现有的xs操作符里，所以先这么办……
                this.$models.liveDetailModel.getRecommendLiveStreamList({
                    gameId: this.$models.liveDetailModel.liveStream.gameInfo.type,
                    exLsId: this.$models.liveDetailModel.liveStream.liveStreamId,
                });
            }
        },
    },
    async asyncData({ liveDetailModel, profileModel, userModel, playbackModel, route }) {
        const principalId = route.params.id;
        const liveDetailPromise = await liveDetailModel.getLiveDetail(principalId);
        const recommendLiveStreamListPromise = liveDetailModel.getRecommendLiveStreamList({
            gameId: liveDetailModel.liveStream.gameInfo.type,
            exLsId: liveDetailModel.liveStream.liveStreamId,
        });
        const recommendWorkListPromise = liveDetailModel.getRecommendWorkList({ principalId: principalId });
        const playbackListPromise = playbackModel.getRecoPlaybackList({
            principalId,
        });
        const promises = [
            recommendLiveStreamListPromise,
            recommendWorkListPromise,
            playbackListPromise,
            liveDetailPromise,
            profileModel.getProfile(principalId),
        ];
        if (userModel.userInfo.id) {
            // 如果用户登录了 重新获取一下用户的信息 主要拿封禁状态
            promises.push(userModel.getUserInfo());
        }
        return waitAllPromiseFinish(promises);
    },
    beforeRouteEnter(to, from, next) {
        // 主要用来跳转到活动页
        if (!hasCookie('activityAccountJumpPage')) {
            next();
            return;
        }
        const id = to.params.id.toLowerCase();
        let activityJumpData = {};
        try {
            activityJumpData = JSON.parse(getCookie('activityAccountJumpPage'));
        } catch (e) {
            next();
            return;
        }
        if (Object.keys(activityJumpData).includes(id)) {
            next({ path: activityJumpData[id] });
            return;
        }
        next();
    },
};
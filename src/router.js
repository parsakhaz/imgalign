import Vue from 'vue';
import Router from 'vue-router';
import MultiStitcher from '@/views/MultiStitcher';

Vue.use(Router)

export default new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: '/',
      name: 'home',
      component: MultiStitcher,
      meta: { title: 'Store Aisle Scanner' }
    },
    {
      path: '*',
      redirect: '/'
    }
  ]
})

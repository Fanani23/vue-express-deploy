export const ROUTES = [
  { path: '/forbidden', name: 'NotAllowed', component: () => import('../../common/views/NotAllowed.vue') },
  { path: '/:catchAll(.*)', name: 'NotFound', component: () => import('../../common/views/NotFound.vue') }
]
export const PUBLIC_ROUTES = [
  { path: '/', name: 'Home', component: () => import('../views/SignIn.vue') },
  { path: '/signin', name: 'SignIn', component: () => import('../views/SignIn.vue') },
  { path: '/signup', name: 'SignUp', component: () => import('../views/SignIn.vue') },
  { path: '/callback', name: 'Callback', component: () => import('../views/Callback.vue') }
]

export const SECURE_ROUTES = [
  { path: '/dashboard', name: 'Dashboard', component: async () => import('../views/Dashboard.vue') },
  { path: '/analytics', name: 'Analytics', component: async () => import('../views/Analytics.vue') },
  { path: '/profile', name: 'Profile', component: async () => import('../views/Profile.vue') },
  { path: '/template-demos/tests', name: 'Vue tests', component: async () => import('../views/Demo/DemoTest.vue') },
  { path: '/template-demos/web-cam', name: 'Web cam', component: () => import('../views/Demo/DemoWebCam.vue') },
  { path: '/template-demos/sign-pad', name: 'Sign pad', component: async () => import('../views/Demo/DemoSignPad.vue') },
  { path: '/template-demos/chart', name: 'Chart', component: async () => import('../views/Visuals/DemoChart1.vue') },
  { path: '/template-demos/map', name: 'Map', component: () => import('../views/Visuals/DemoLeaflet.vue') },
  { path: '/template-demos/form', name: 'Form', component: async () => import('../views/DataEntry/DemoForm.vue') },
  { path: '/template-demos/card', name: 'Card', component: async () => import('../views/DataEntry/DemoCard.vue') },
  { path: '/template-demos/cascade', name: 'Cascade', component: async () => import('../views/DataEntry/DemoCascade.vue') },
  { path: '/template-demos/cascade2', name: 'Cascade 2', component: async () => import('../views/DataEntry/DemoCascade2.vue') },
  { path: '/template-demos/cascade2-api', name: 'Cascade 2 (API)', component: async () => import('../views/Favv/DemoCascade2Api.vue') },
  { path: '/template-demos/fill', name: 'Route params', component: async () => import('../views/Demo/Filler.vue') },
  { path: '/template-demos/fill/:param', name: 'Fill Param', component: async () => import('../views/Demo/Filler.vue'), hidden: true },
  { path: '/test', name: 'Fill No ID', component: async () => import('../views/Demo/Filler.vue'), hidden: true },
  ...Array.from(Array(15), (x, i) => {
    return { path: '/test/' + i, name: 'Fill ID ' + i, component: async () => import('../views/Demo/Filler.vue'), props: { testId: i }, hidden: true }
  }),
]

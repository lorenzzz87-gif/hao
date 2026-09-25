import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const deviceLanguage = getLocales()[0]?.languageCode;

// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'en',
  lng: deviceLanguage === 'it' || deviceLanguage === 'zh' ? deviceLanguage : 'en',
  interpolation: { escapeValue: false },
  resources: {
    en: { translation: { now: 'Now', map: 'Map', create: 'Create', chats: 'Orbits', me: 'Me', tryAgain: 'Try again', home: { nearby: 'Nearby now', hero: 'Meet people.\nDo something. Now.', subtitle: 'Spontaneous plans nearby, for the next six hours.', free: "I'm free", forming: "See what's forming nearby", plans: 'Plans near you', seeMap: 'See map' }, location: { title: 'Find plans around you', privacy: 'HAO uses your area only for distance and nearby search. People never see your live location.', use: 'Use my location', retry: 'Try location again', settings: 'Open settings', manual: 'or browse without location' } } },
    it: { translation: { now: 'Ora', map: 'Mappa', create: 'Crea', chats: 'Gruppi', me: 'Profilo', tryAgain: 'Riprova', home: { nearby: 'Vicino a te', hero: 'Incontra persone.\nFai qualcosa. Ora.', subtitle: 'Programmi spontanei nelle vicinanze per le prossime sei ore.', free: 'Sono libero', forming: 'Scopri cosa si sta formando', plans: 'Programmi vicino a te', seeMap: 'Vedi mappa' }, location: { title: 'Trova programmi vicino a te', privacy: 'HAO usa solo la tua zona per distanza e ricerca. Nessuno vede la tua posizione in tempo reale.', use: 'Usa la mia posizione', retry: 'Riprova posizione', settings: 'Apri impostazioni', manual: 'oppure esplora senza posizione' } } },
    zh: { translation: { now: '现在', map: '地图', create: '创建', chats: '群聊', me: '我的', tryAgain: '重试', home: { nearby: '附近动态', hero: '认识新朋友。\n现在就出发。', subtitle: '发现附近六小时内的即时活动。', free: '我有空', forming: '看看附近正在组什么局', plans: '附近计划', seeMap: '查看地图' }, location: { title: '查找附近计划', privacy: 'HAO 只使用大致区域计算距离和搜索，其他人永远看不到你的实时位置。', use: '使用我的位置', retry: '重试定位', settings: '打开设置', manual: '或不使用定位直接浏览' } } },
  },
});

export default i18n;

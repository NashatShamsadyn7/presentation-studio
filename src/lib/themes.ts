// ═══════════ ٢٤ پاشبنەما — هەریەکە تەنها ٨ ڕەنگە ═══════════

export interface Theme {
  id: string;
  name: string;      // بە کوردی
  dark: boolean;
  v: {
    '--slide-bg': string;
    '--ink': string;
    '--ink-soft': string;
    '--pri': string;
    '--pri-soft': string;
    '--acc': string;
    '--glass': string;
    '--glass-line': string;
  };
}

const L = 'rgba(255,255,255,';
const D = 'rgba(255,255,255,';

export const THEMES: Theme[] = [
  // ─────────── ڕووناک ───────────
  { id:'academic-blue', name:'شینی ئەکادیمی', dark:false, v:{
    '--slide-bg':'#DFE4EA','--ink':'#0A0A0A','--ink-soft':'#4A5568',
    '--pri':'#5C77BC','--pri-soft':'#8FA0D2','--acc':'#EFC45E',
    '--glass':L+'.42)','--glass-line':L+'.62)'}},
  { id:'deep-blue', name:'شینی ناوەڕاست', dark:false, v:{
    '--slide-bg':'#E4EAF2','--ink':'#0C1A2E','--ink-soft':'#3C5A7A',
    '--pri':'#1F4E79','--pri-soft':'#7E9CC0','--acc':'#D9A441',
    '--glass':L+'.50)','--glass-line':L+'.72)'}},
  { id:'university-gold', name:'تەلای زانکۆ', dark:false, v:{
    '--slide-bg':'#E8EAF0','--ink':'#0B1533','--ink-soft':'#3A456B',
    '--pri':'#122B60','--pri-soft':'#8892B8','--acc':'#C9A227',
    '--glass':L+'.52)','--glass-line':L+'.78)'}},
  { id:'sky', name:'ئاسمانی ڕووناک', dark:false, v:{
    '--slide-bg':'#E6F0F7','--ink':'#0A2233','--ink-soft':'#3E6076',
    '--pri':'#2E7FA8','--pri-soft':'#93C2DA','--acc':'#EFAE4E',
    '--glass':L+'.50)','--glass-line':L+'.76)'}},
  { id:'nature-green', name:'سەوزی سروشتی', dark:false, v:{
    '--slide-bg':'#E4EBE4','--ink':'#10241A','--ink-soft':'#42604F',
    '--pri':'#3F7D5C','--pri-soft':'#93BCA5','--acc':'#E0AC46',
    '--glass':L+'.46)','--glass-line':L+'.70)'}},
  { id:'marine', name:'دەریایی', dark:false, v:{
    '--slide-bg':'#DFEDEC','--ink':'#062522','--ink-soft':'#365E5A',
    '--pri':'#136F63','--pri-soft':'#84B8B1','--acc':'#E8A33D',
    '--glass':L+'.48)','--glass-line':L+'.74)'}},
  { id:'teal-tech', name:'تەکنیکی سیان', dark:false, v:{
    '--slide-bg':'#E0EAEC','--ink':'#08201F','--ink-soft':'#37585A',
    '--pri':'#1E6E72','--pri-soft':'#86B3B5','--acc':'#E2A03F',
    '--glass':L+'.48)','--glass-line':L+'.72)'}},
  { id:'olive', name:'زەیتوونی', dark:false, v:{
    '--slide-bg':'#EAEBDF','--ink':'#1D2210','--ink-soft':'#4F5834',
    '--pri':'#6B7A3A','--pri-soft':'#B2BC8C','--acc':'#C8622F',
    '--glass':L+'.50)','--glass-line':L+'.76)'}},
  { id:'crimson', name:'سووری زانکۆ', dark:false, v:{
    '--slide-bg':'#EEE6E6','--ink':'#210E0E','--ink-soft':'#5E3B3B',
    '--pri':'#8E2F3A','--pri-soft':'#C79098','--acc':'#D4A24C',
    '--glass':L+'.48)','--glass-line':L+'.72)'}},
  { id:'purple', name:'مۆری ئەکادیمی', dark:false, v:{
    '--slide-bg':'#E9E6F0','--ink':'#180F26','--ink-soft':'#4B3D63',
    '--pri':'#5B4B8A','--pri-soft':'#A398C6','--acc':'#E2B455',
    '--glass':L+'.46)','--glass-line':L+'.70)'}},
  { id:'bronze', name:'برۆنزی کلاسیک', dark:false, v:{
    '--slide-bg':'#F0EAE0','--ink':'#241B10','--ink-soft':'#5C4B33',
    '--pri':'#8A6A3E','--pri-soft':'#C2A97F','--acc':'#3E6B7A',
    '--glass':L+'.50)','--glass-line':L+'.75)'}},
  { id:'warm-brown', name:'قاوەیی گەرم', dark:false, v:{
    '--slide-bg':'#EFE7E0','--ink':'#241812','--ink-soft':'#5C4638',
    '--pri':'#7B4B2E','--pri-soft':'#C4A18B','--acc':'#3F7A6E',
    '--glass':L+'.52)','--glass-line':L+'.78)'}},
  { id:'rose', name:'پەمەیی نەرم', dark:false, v:{
    '--slide-bg':'#F2E8EA','--ink':'#26141A','--ink-soft':'#5E3F49',
    '--pri':'#A34E68','--pri-soft':'#D9A8B6','--acc':'#3E6F7E',
    '--glass':L+'.54)','--glass-line':L+'.80)'}},
  { id:'modern-gray', name:'خۆڵەمێشی مۆدێرن', dark:false, v:{
    '--slide-bg':'#ECEEF1','--ink':'#15181C','--ink-soft':'#4C525B',
    '--pri':'#3C4650','--pri-soft':'#A2AAB4','--acc':'#D9873F',
    '--glass':L+'.56)','--glass-line':L+'.82)'}},
  { id:'warm-orange', name:'نارنجی گەرم', dark:false, v:{
    '--slide-bg':'#F3EBE2','--ink':'#291708','--ink-soft':'#634728',
    '--pri':'#C4661F','--pri-soft':'#E3B389','--acc':'#2F6076',
    '--glass':L+'.54)','--glass-line':L+'.80)'}},

  // ─────────── تاریک ───────────
  { id:'night-blue', name:'شەوانەی شین', dark:true, v:{
    '--slide-bg':'#141C2B','--ink':'#F1F5FB','--ink-soft':'#A7B4C9',
    '--pri':'#7C95E0','--pri-soft':'#3E4E75','--acc':'#E9B54B',
    '--glass':D+'.06)','--glass-line':D+'.14)'}},
  { id:'night-black', name:'شەوانەی ڕەش', dark:true, v:{
    '--slide-bg':'#111112','--ink':'#F5F3EE','--ink-soft':'#A9A49A',
    '--pri':'#C9A54E','--pri-soft':'#4A4235','--acc':'#E8D9A8',
    '--glass':D+'.05)','--glass-line':D+'.12)'}},
  { id:'night-green', name:'شەوانەی سەوز', dark:true, v:{
    '--slide-bg':'#101E19','--ink':'#EDF5F0','--ink-soft':'#9DB8AB',
    '--pri':'#4FA97C','--pri-soft':'#2C4A3C','--acc':'#E0B052',
    '--glass':D+'.055)','--glass-line':D+'.13)'}},
  { id:'night-purple', name:'شەوانەی مۆر', dark:true, v:{
    '--slide-bg':'#171327','--ink':'#F2EFFA','--ink-soft':'#AEA3C6',
    '--pri':'#8E7BD8','--pri-soft':'#3E3559','--acc':'#E5B657',
    '--glass':D+'.06)','--glass-line':D+'.14)'}},
  { id:'night-gray', name:'شەوانەی خۆڵەمێش', dark:true, v:{
    '--slide-bg':'#1A1D22','--ink':'#EEF1F5','--ink-soft':'#A3ABB8',
    '--pri':'#6E8BA8','--pri-soft':'#3A444F','--acc':'#D8A657',
    '--glass':D+'.055)','--glass-line':D+'.13)'}},
  { id:'night-indigo', name:'شەوانەی نیلی', dark:true, v:{
    '--slide-bg':'#0F1230','--ink':'#EEF0FF','--ink-soft':'#A2A8D0',
    '--pri':'#7B7BE8','--pri-soft':'#343A6E','--acc':'#E7C15A',
    '--glass':D+'.06)','--glass-line':D+'.14)'}},
  { id:'night-marine', name:'شەوانەی دەریایی', dark:true, v:{
    '--slide-bg':'#0C1F1F','--ink':'#E9F5F3','--ink-soft':'#93B9B4',
    '--pri':'#3FA79A','--pri-soft':'#28504C','--acc':'#E4AF4E',
    '--glass':D+'.055)','--glass-line':D+'.13)'}},
  { id:'night-crimson', name:'شەوانەی سووری تۆخ', dark:true, v:{
    '--slide-bg':'#1E1214','--ink':'#F7EDEE','--ink-soft':'#BFA1A5',
    '--pri':'#C25460','--pri-soft':'#573035','--acc':'#DDB25C',
    '--glass':D+'.055)','--glass-line':D+'.13)'}},
  { id:'night-brown', name:'شەوانەی قاوەیی', dark:true, v:{
    '--slide-bg':'#1C1712','--ink':'#F4EFE7','--ink-soft':'#B9AA97',
    '--pri':'#B08251','--pri-soft':'#4A3B2C','--acc':'#8FBF9B',
    '--glass':D+'.05)','--glass-line':D+'.12)'}},
];

export const byId = (id: string) => THEMES.find(t => t.id === id) ?? THEMES[0];

/** دەیخاتە سەر ڕەگی دۆکیومێنت یان هەر توخمێکی تر */
export function applyTheme(id: string, el: HTMLElement | null = null) {
  const t = byId(id);
  const target = el ?? document.documentElement;
  Object.entries(t.v).forEach(([k, val]) => target.style.setProperty(k, val));
}

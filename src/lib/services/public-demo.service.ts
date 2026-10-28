import { showToast } from '../../components/ui/toast.ts';
export function initializePublicDemo(): void {
  if(document.documentElement.dataset.vacatinaDemo!=='true')return;
  (window as any).__VACATINA_PUBLIC_DEMO__=true;
  document.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLElement>('a,button');
    if(button&&(/^(sign\s?in|sign\s?up)$/i.test(button.textContent?.trim()||'')||/^\/(login|sign-in|sign-up|register)/.test(button.getAttribute('href')||''))){event.preventDefault();event.stopImmediatePropagation();showToast('DEMO / TEST: hosted sign-in is disabled until fresh isolated identity is qualified.','warning');}
  },true);
  document.addEventListener('submit',event=>{
    const form=event.target as HTMLFormElement;
    if(form.querySelector('input[type=email],input[type=tel],input[type=password],input[type=file]')){event.preventDefault();event.stopImmediatePropagation();showToast('DEMO / TEST: personal information and document submission are disabled.','warning');}
  },true);
}

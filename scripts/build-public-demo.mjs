process.env.VACATINA_PUBLIC_DEMO='1';
const {buildProject}=await import('./build.mjs');buildProject();

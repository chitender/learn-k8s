import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive:true, force:true });
fs.mkdirSync(dist, { recursive:true });

for (const file of ['index.html','pro.html','styles.css','styles-experience.css','styles-incidents.css','styles-pro.css']) {
  if (fs.existsSync(path.join(root,file))) fs.copyFileSync(path.join(root,file), path.join(dist,file));
}
fs.cpSync(path.join(root,'src'), path.join(dist,'src'), { recursive:true });

const cfg = {
  apiUrl: process.env.LEARN_K8S_API_URL || '',
  awsRegion: process.env.AWS_REGION || 'ap-south-1',
  cognitoClientId: process.env.COGNITO_CLIENT_ID || '',
  cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID || '',
  paidExamsEnabled: process.env.PAID_EXAMS_ENABLED === 'true',
  liveLabsEnabled: process.env.LIVE_LABS_ENABLED === 'true'
};
fs.writeFileSync(path.join(dist,'runtime-config.js'), `window.LEARN_K8S_CONFIG = Object.freeze(${JSON.stringify(cfg)});\n`);
console.log('Built static site into dist/');

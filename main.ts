import{readFileSync as R,writeFileSync as W,mkdirSync as M,readdirSync as D}from"node:fs";
let E=process.env,I=E.MAKEFUN_INPUT_DIR||"/input",O=E.MAKEFUN_OUTPUT_DIR||"/output",F=c=>{throw c},S,C,U=()=>{if(S.length>255)F(3)},G=c=>{if(S.length<c)F(2)};
for(let d of D(I)){
let y=I+"/"+d+"/",z=O+"/"+d+"/",P=R(y+"program.bin"),N=R(y+"input.bin"),m=Array(256).fill(0),o=[],p=0,t=0,q=0,e=0,a,b,s,r;
S=[];C=[];
try{for(;;){
if(t>=1e6)F(10);
if(p<0||p>=P.length)F(9);
let u=P[p],im=u==1?1:u==2?4:u>47&&u<52?2:0;
if(p+im>=P.length)F(9);
t++;
let n=p+1+im;
r=im==2?P.readInt16LE(p+1):0;
if(u>15&&u<35&&u!=31){
let w=u==23||u==27;
G(w?1:2);b=S.pop();a=w?b:S.pop();
if(u>18&&u<23&&!b)F(4);
S.push(u==16?(a+b)|0:u==17?(a-b)|0:u==18?Math.imul(a,b):u==19?(a/b)|0:u==20?(a%b)|0:u==21?Math.floor((a>>>0)/(b>>>0))|0:u==22?(a>>>0)%(b>>>0)|0:u==23?-a|0:u==24?a&b:u==25?a|b:u==26?a^b:u==27?~a:u==28?a<<b:u==29?a>>b:u==30?(a>>>b)|0:u==32?+(a==b):u==33?+(a<b):+((a>>>0)<(b>>>0)));
}else switch(u){
case 0:F(0);
case 1:U();S.push(P[p+1]<<24>>24);break;
case 2:U();S.push(P.readInt32LE(p+1));break;
case 3:G(1);S.pop();break;
case 4:G(1);U();S.push(S.at(-1));break;
case 5:G(2);b=S.pop();S.push(b,S.pop());break;
case 6:G(2);U();S.push(S.at(-2));break;
case 7:G(3);S.splice(S.length-3,3,S.at(-2),S.at(-1),S.at(-3));break;
case 48:n+=r;break;
case 49:case 50:G(1);if((S.pop()==0)==(u==49))n+=r;break;
case 51:if(C.length>63)F(7);C.push(n);n=r&65535;break;
case 52:if(!C.length)F(8);n=C.pop();break;
case 64:G(1);a=S.at(-1);if(a<0||a>255)F(6);S[S.length-1]=m[a];break;
case 65:G(2);a=S.pop();if(a<0||a>255)F(6);m[a]=S.pop();break;
case 80:G(1);s=String(S.at(-1));if(o.length+s.length>65536)F(11);S.pop();o.push(...Buffer.from(s));break;
case 81:G(1);if(o.length>65535)F(11);o.push(S.pop()&255);break;
case 82:U();S.push(q<N.length?N[q++]:-1);break;
case 83:G(1);F(S.pop()&255);
default:F(5)}
p=n;
}}catch(x){e=x}
M(z,{recursive:!0});W(z+"stdout.bin",Buffer.from(o));W(z+"exit.txt",e+"\n");
}

/**
 * Created by WX on 2018/6/20.
 *
 * 百度图片抓取。
 *
 */


const readline = require('readline');
const su = require("superagent");
const fs = require("fs");
const path = require("path");
const http = require("http");
http.globalAgent.maxSockets=10000;
http.globalAgent.timeout=2000;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


let number = 1;
(async ()=>{
    try{
        let keyword = await question("输入关键词：");
        let dir = await question("输入目录：");
        let page_type = await question("输入分页方式，(1)自动；(2)手动： ");
        page_type = parseInt(page_type);
        if(!page_type||page_type>1){
            page_type=2;
        }
        if(page_type&&page_type===1){

        }
        let confirm = await question("确认条件，检索词["+keyword+"]  目录["+dir+"]  分页方式["+(page_type===1?"自动":"手动")+"]。 Y/N   ：");
        if(confirm.toLowerCase()!=="y"){
            console.log("bye");
            rl.close();
            return;
        }
        keyword = encodeURIComponent(keyword);
        await mkdirs(dir);

        await baidupic_fectch(keyword, dir, page_type, 0);
    }catch(e){
        console.error(e);
        rl.close();
    }
})();


async function baidupic_fectch(keyword, dir, page_type, page){
    let url = "https://image.baidu.com/search/flip?tn=baiduimage&ie=utf-8&word="+keyword+"&pn="+page;
    console.log("查询地址："+url);
    let response = await su.get(url);

    let pics = [];
    let obj = void 0;
    let html = response.text;
    for(let begin = 0, end=html.indexOf("\n"); begin<html.length&&end>0;begin=end+1,end=html.indexOf("\n", begin)){
        let line = html.substring(begin, end).trim();
        if(line.startsWith("flip.setData('imgData',")){
            line = line.substring(23, line.indexOf(");"));
            obj = JSON.parse(line);
            break;
        }
    }

    //找到图片对象集合
    if(obj&&obj.data&&obj.data.length>0){
        for(let i in obj.data){
            let pic = obj.data[i].objURL?obj.data[i].objURL:obj.data[i].thumbURL;
            if(pic){
                pics.push(pic);
            }
        }
    }

    if(pics.length===0){
        await question("没有找到更多图片! 按任意键结束");
        rl.close();
        return;
    }else{
        let promises = [];
        for(let i=0; i<pics.length; i++){
            let idx = number++;
            promises.push(download(pics[i],dir, idx));
        }
        await Promise.all(promises);
    }

    if(page_type===2){
        let progress = await question("可能有更多分页，是否继续？ Y/N：");
        if(progress.toLowerCase()!=="y"){
            console.log("bye bye");
            rl.close();
            return;
        }
    }

    process.nextTick(async ()=>{await baidupic_fectch(keyword, dir, page_type, page+20)});
}



function download(url, dir, idx) {
    //下载图片
    return new Promise((rs,rj)=>setTimeout(()=>{
        try{
            let localpath = path.join(dir, path.basename(url));
            if(localpath.indexOf('?')>0){
                localpath = localpath.substring(0, localpath.indexOf('?'));
            }
            let stream = fs.createWriteStream(localpath);
            let req = su.get(url);
            req.pipe(stream);
            req.on("error",(err)=>{
                console.error("第"+idx+"张图片: "+url+"出现错误:"+err);
                rs();
            });
            req.on("end", ()=>{
                console.log("第"+idx+"张图片: "+url+"下载完成");
                rs();
            });
        }catch(e){
            console.error("第"+idx+"张图片: "+url+"出现错误:"+e);
            rs();
        }
    },20));
}


//递归创建目录 异步方法
function mkdirs(dirname) {
    let defered = new Defered();
    fs.exists(dirname, (exists)=>{
        //如果目录存在，则执行后续处理
        if (exists) {
            defered.resolve(dirname);
        } else {
            //否则，创建该目录
            let parent = path.dirname(dirname);
            //如果父目录存在，则创建该目录，否则创建父目录
            fs.exists(parent, (exists)=>{
                if(exists){
                    fs.mkdir(dirname, (err)=>{
                        if(err&&err.code!=="EEXIST"){
                            defered.reject(err);
                            return;
                        }
                        defered.resolve(dirname);
                    });
                }else{
                    mkdirs(parent,
                        //父目录创建成功之后，创建本目录，然后执行callback
                        ()=>{
                            fs.mkdir(dirname, (err)=>{
                                if(err&&err.code!=="EEXIST"){
                                    defered.reject(err);
                                    return;
                                }
                                defered.resolve(dirname);
                            });
                        },
                        (err)=>{
                            //如果父目录存在，则执行本目录创建，然后callback
                            defered.reject(err);
                        }
                    );
                }
            });
        }
    });
    return defered.promise;
}

function Defered(){
    this.promise = new Promise((rs, rj)=>{
        this.rs = rs;
        this.rj = rj;
    });

    this.resolve = function(data){
        this.rs(data);
    };

    this.reject = function(e){
        this.rj(e);
    }
}

function question(str){
    return new Promise((rs, rj)=>{
        rl.question(str, (answer) => {
            rs(answer);
        });
    })
}

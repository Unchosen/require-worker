/* global process, require, __filename, __dirname, Promise */
"use strict";

const path = require('path');
const childProcess = require('child_process');
const eventEmitter = require('events');

const _ = require(path.resolve(__dirname,'./lib/underscore-with-mixins'));
const proxyCom = require(path.resolve(__dirname,'./lib/proxy-communication'));
const ipcTransport = require(path.resolve(__dirname,'./lib/ipc-transport'));

module.exports = exports = (target)=>{
	if(_.isString(target))try{ target = require.resolve(target); }catch(err){}
	if(hostsMap.has(target)) return hostsMap.get(target);
	if(clientsMap.size===0 && hostsMap.size>0) throw Error("first argument must be a valid require-worker host or file path");
	if(!clientsMap.has(target)) throw Error("first argument must be a valid require-worker client or file path");
	return clientsMap.get(target);
};

module.exports.require = (path,options)=>new client(path,options);

const getStackFiles = function getStackFiles(){
	let opst = Error.prepareStackTrace, thisError, result = [];
	Error.prepareStackTrace = (errStackStr,cssfArr)=>cssfArr;
	thisError = new Error();
	Error.captureStackTrace(thisError,getStackFiles); // https://nodejs.org/api/errors.html#errors_new_error_message
	let cssfArr = thisError.stack;
	Error.prepareStackTrace = opst;
	for(let i=0,l=cssfArr.length; i<l; i++){
		let cssf = cssfArr[i]; // https://github.com/v8/v8/wiki/Stack-Trace-API
		let file = cssf.getFileName();
		if(file===__filename) continue;
		result.push(file);
	}
	return result; 
};

var clientIndex = 0;
const clientsMap = new Map();
const client = function requireWorkerClient(file,options={ ownProcess:false, shareProcess:false, parentModule:false }){
	if(!_.isString(file)) throw Error("first argument must be a string (require path)");
	if(!_.isObject(options)) throw Error("second argument must be an object (options) or undefined");
	var self = this;
	self.id = (++clientIndex)+':'+_.uniqueId()+':'+Date.now();//+':'+file;
	self.options = options;
	self.events = new eventEmitter();
	self.ipcTransport = ipcTransport.create({
		id: 'require-worker:'+self.id
	});
	var hostOptions = {
		transport: 'ipcTransport',
		ipcTransportID: self.ipcTransport.id
	};
	self.file = file;
	if(path.isAbsolute(file)) hostOptions.file = file;
	else {
		if(options.parentModule && options.parentModule.require) try{ hostOptions.file = options.parentModule.require.resolve(file); }catch(err){}
		if(!hostOptions.file) try{
			var prevStackDir = path.dirname(getStackFiles()[0]);
			try{ // file relative to the directory
				hostOptions.file = require.resolve(path.resolve(prevStackDir,file));
			}catch(err1){
				try{ // file itself (eg, nodejs module), on local require
					hostOptions.file = require.resolve(file);
				}catch(err2){ // fallback to setting cwd of fork
					hostOptions.file = file;
					if(!('forkOptions' in options)) options.forkOptions = {};
					options.forkOptions.cwd = prevStackDir;
					options.ownProcess = true;
				}
			}
		}catch(err){}
		if(!hostOptions.file) hostOptions.file = file;
	}
	self.hostOptions = hostOptions;
	var rwPObj = rwProcess({ client:self });
	self.ipcTransport.setChild(self.child);
	var rwPTransport = rwPObj.ipcTransport.createMessageEventEmitter();
	rwPTransport.once('processReady!',()=>{
		rwPTransport.send('requireHost',hostOptions);
	});
	rwPTransport.send('processReady?');
	if(!clientsMap.has(file)) clientsMap.set(file,self);
	try{ clientsMap.set(hostOptions.file,self); }catch(err){}
	self.proxyCom = proxyCom.create({
		transport: { type:'ipcTransport', instance:self.ipcTransport },
		requireWorkerClient: self
	});
	self.proxyCom.transport.once('requireState',({message,stack}={})=>{
		if(stack){
			if(rwPObj.ownProcess) self.child.kill();
			var e = new Error(message);
			e.stack = stack;
			self.events.emit('error',e); //throw e;
		}
	});
	self.proxyCom.connectTransportClient();
	self.proxy = self.proxyCom.createMainProxyInterface();
	clientsMap.set(self.proxy,self);
	return self.proxy;
};

client.prototype = {
	setChildReferenced: function(bool){
		if(bool) this.child.ref();
		else this.child.unref();
	}
};

var rwProcessIndex = 0;
const rwProcessMap = new Map();
const rwProcess = function(options={}){
	var client = options.client;
	var ownProcess = !!client.options.ownProcess;
	var shareProcess = client.options.shareProcess;
	if(!client) return Promise.reject();
	var createNewProcess = (rwProcessMap.size===0 || ownProcess);
	var useExistingObj = null;
	if(!createNewProcess){
		createNewProcess = true;
		for(var [child,obj] of rwProcessMap){
			if(shareProcess && (shareProcess===obj.client || shareProcess===obj.client.proxy || shareProcess===child)){
				createNewProcess = false;
				useExistingObj = obj;
				break;
			}
			if(!shareProcess && !obj.ownProcess){
				createNewProcess = false;
				useExistingObj = obj;
				break;
			}
		}
		if(shareProcess && !useExistingObj) throw Error("Existing require-worker process could not be found, set shareProcess to a client object, client proxy, or a process child");
	}
	if(createNewProcess){
		var rwPObj = { ownProcess, id:'require-worker:process:'+(++rwProcessIndex)+':'+Date.now(), client };
		rwPObj.ipcTransport = ipcTransport.create({ id:rwPObj.id });
		if(!('forkOptions' in client.options)) client.options.forkOptions = {};
		if(!('cwd' in client.options.forkOptions)) client.options.forkOptions.cwd = process.cwd();
		//var processArgv = _.clone(process.execArgv);
		//if(process.execArgv.indexOf('--inspect')!==-1) process.execArgv.splice(process.execArgv.indexOf('--inspect'),1);
		rwPObj.child = client.child = childProcess.fork(__filename,['--rwProcess',rwPObj.id],client.options.forkOptions);
		//process.execArgv = processArgv;
		rwPObj.ipcTransport.setChild(rwPObj.child);
		rwProcessMap.set(rwPObj.child,rwPObj);
		return rwPObj;
	} else {
		client.child = useExistingObj.child;
		return useExistingObj;
	}
};

const checkNewProcess = ()=>{
	if(require.main===module && process.argv.length===4 && process.argv[2]==='--rwProcess'){
		var ipcTransportID = process.argv[3];
		var transport = ipcTransport.create({
			id: ipcTransportID,
			parent: true
		});
		var transportEvents = transport.createMessageEventEmitter();
		transportEvents.on('processReady?',()=>{
			transportEvents.send('processReady!');
		});
		transportEvents.on('requireHost',(hostOptions)=>{
			new host(hostOptions);
		});
		transportEvents.send('processReady!');
	}
};

const hostsMap = new Map();
const host = function requireWorkerHost({ transport, ipcTransportID, file }){
	var self = this;
	if(transport!=='ipcTransport') throw Error("Invalid transport, only ipcTransport is currently implemented");
	self.events = new eventEmitter();
	self.ipcTransport = ipcTransport.create({
		id: ipcTransportID,
		parent: true
	});
	self.proxyCom = proxyCom.create({
		transport: { type:'ipcTransport', instance:self.ipcTransport },
		requireWorkerHost: self
	});
	var requireError;
	self.proxyCom.connectTransportHost(()=>{
		if(requireError){
			self.proxyCom.transport.send("requireState",_.pick(requireError,['message','stack']));
		} else {
			self.proxyCom.transport.send("requireState");
			self.proxyCom.setProxyTarget(self.exports);
		}
	});
	try{ hostsMap.set(require.resolve(file),self); }catch(err){}
	try{
		self.exports = require(file);
		hostsMap.set(self.exports,self);
	}catch(err){
		requireError = err;
	}
	return this;
};

host.prototype = {
	
};

checkNewProcess();

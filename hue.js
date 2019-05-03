
/*
The Hue bridge periodically polls the portal, which stores both the external and internal
 (in the home network) IP of the bridge, plus the MAC address. If the portal has not received 
 the “I’m alive” message from a specific bridge for a longer period it will consider the bridge 
 disconnected. The Hue portal has linked the public IP address of the users network with the MAC 
 address and local IP address of the Hue bridge.
 In case of an empty JSON array reply (i.e. [ ]), no Hue bridge has been found. This can be because 
 the user never connected the bridge to the Internet or it has been considered to be disconnected, 
 in that case an option is to perform an “IP scan”, or ask the user to enter an IP address of the Hue bridge.

Best practice is to wait a maximum of 8 seconds for receiving the N-UPnP repsonse back from the Hue portal 
before continuing


When setting a lights state DO NOT continiously send stata.on true.  

*/
const HUE_DISCOVERY_URL = 'https://discovery.meethue.com';	
const HUE_DESCRIPTION_URL ='/description.xml';
const HUE_SEARCH_TERM = 'Philips hue bridge';
const HUE_DISCOVERY_TIMEOUT = 8000;
const HUE_STD_TIMEOUT = 5000;
const HUE_REGISTER_USER_TIMEOUT = 30000;
const HUE_FAILFAST_TIMEOUT = 500;

const RESTFUL_API_MIMETYPE = 'application/json';
const RESTFUL_API_HEADERS_CONTENT_TYPE = 'Content-Type';
const RESTFUL_API_CORS = 'cors';
const RESTFUL_API_METHOD_GET = 'GET';
const RESTFUL_API_METHOD_PUT = 'PUT';
const RESTFUL_API_METHOD_POST = 'POST';
const RESTFUL_API_METHOD_DELETE = 'DELETE';

const HUE_DISCOVERY_STATUS_INIT = 0;
const HUE_DISCOVERY_STATUS_PENDING = 1;
const HUE_DISCOVERY_STATUS_COMPLETE = 2;
const HUE_DISCOVERY_STATUS_FAILED = 3;

const HUE_USER_STATUS_INIT = 0;
const HUE_USER_STATUS_PENDING = 1;
const HUE_USER_STATUS_REGISTER = 2;
const HUE_USER_STATUS_REGISTERED = 3;
const HUE_USER_STATUS_FAILED = 4;

const HUE_DEFAULT_BRIDGE = 0;
const HUE_DEFAULT_IPADDR = 'internalipaddress';
const HUE_ERROR_NODE = "error";
const HUE_SUCCESS_NODE = "success";
const HUE_ERROR_DESC_ATTR = "description";
const HUE_USERNAME_ATTR = "username";

const HUE_ERROR_UNAUTH_USER = "unauthorized user";
const HUE_ERROR_LINKBUTTON_NOTPRESSES = "link button not pressed";
const HUE_ERROR_PAYLOADINVALID = "body contains invalid json";

const HUE_URL_HTTPS = 'https://';
const HUE_URL_API = '/api';
const HUE_URL_API_LIGHTS = '/lights';
const HUE_BLANK = "";
const HUE_DEFAULT_APPNAME = "HUEAPP";



const RESTFUL_API_STANDARD_CORS_HEADER 
	=  {
			mode: RESTFUL_API_CORS,
  			method: RESTFUL_API_METHOD_GET,
		};

const RESTFUL_API_STANDARD_POST_HEADER 
	= {
 		method: RESTFUL_API_METHOD_POST,
  		body: null, 
  		headers:
  			{
    			'Content-Type': RESTFUL_API_MIMETYPE
  			}
	}

const RESTFUL_API_STANDARD_PUT_HEADER 
	= {
 		method: RESTFUL_API_METHOD_PUT,
  		body: null, 
  		headers:
  			{
    			'Content-Type': RESTFUL_API_MIMETYPE
  			}
	}




class HueRestful {

	constructor ( _usrKey ){
		this.bridgeIPAddr = null;
		this.discoveryStatus = HUE_DISCOVERY_STATUS_INIT;
		this.bridgeDiscoveryResponse = null;
		this.userStatus = HUE_USER_STATUS_INIT;
		this.userKey = _usrKey;
		this.huecommand_getLights = `/lights`;
		this.hueLights = null;

	}



	/**
	 *
	 *
	 *
	 *
	 */
	api_lights_url() {
		return (`${HUE_URL_HTTPS}${this.bridgeIPAddr}${HUE_URL_API}/${this.userKey}${HUE_URL_API_LIGHTS}`);
	}

	api_setlights_url(_id) {
		return (`${HUE_URL_HTTPS}${this.bridgeIPAddr}${HUE_URL_API}/${this.userKey}${HUE_URL_API_LIGHTS}/${_id}/state`);
	}


	api_reg_url() {
		return (`${HUE_URL_HTTPS}${this.bridgeIPAddr}${HUE_URL_API}`);
	}

	/**
	 *
	 *
	 *
	 *
	 */
	isKeyValid( _usr  , _headers = RESTFUL_API_STANDARD_CORS_HEADER, _timeout = HUE_STD_TIMEOUT, fetchLightsOnSuccess = true) {

		const url = this.api_lights_url();
		const func = `isUserRegistered url:${url}`;

		if ( this.discoveryStatus != HUE_DISCOVERY_STATUS_COMPLETE ) {
			console.log(`${fuc} - discovery must be performed befre Usr registration can be verified`);
			return false;
		}

		this.userStatus = HUE_USER_STATUS_PENDING;
		
		if ( this.userKey === HUE_BLANK){
			console.log(`${func} - userKey is blank. Register new user`);
			this.userStatus = HUE_USER_STATUS_FAILED;
			return false;
		}

		const controller = new AbortController();
		const signal = controller.signal;
		const timeoutId = setTimeout(() => controller.abort(), _timeout);
		
		fetch(url,{signal},_headers).then( response => {
			
			clearTimeout(timeoutId);
		
			if ( !response.ok || (response.status != 200 ))
				throw Error (`isUserRegistered - request failed ${response.url} : ${response.status} - ${response.statusText} `);

			return response.json();
		
		})
		.then( body => {

			const responseMeta = this.responseHasError(body, HUE_ERROR_UNAUTH_USER);

			if (responseMeta.isError && !responseMeta.exactMatch )
				throw Error (`${func} user must be registered ${!responseMeta.exactMatch?" unexpected error block:" : HUE_BLANK} ${responseMeta.description}`);
		
			else if ( responseMeta.isError && responseMeta.exactMatch)
				return null;
			
			if (body.hasOwnProperty('1') === true )
				return this.userKey; // if we can locate at least 1 light with the url with the user key embedded, then the user key must be valid
			
			else 
				throw Error (`${func} - unexpected response ${JSON.stringify(body)}`);
		
		})
		.then ( usrKey => {

			if (usrKey === null ){
				
				this.userStatus = HUE_USER_STATUS_REGISTER;
				console.log(`usr verification failed - using Hue bridge ${this.bridgeIPAddr} user must be registed userStatus = ${this.userStatus}`);

			}else {

				this.userStatus = HUE_USER_STATUS_REGISTERED;
				console.log(`usr verification - using Hue bridge ${this.bridgeIPAddr} with key ${this.userKey} userStatus = ${this.userStatus}`);
				if (fetchLightsOnSuccess)
					this.getHueLights();
		
			}
			
		})
		.catch( err => {

			this.userStatus = HUE_USER_STATUS_FAILED;
			console.error( err )
	
		});

	}

	/**
	 *
	 *
	 *
	 */
	responseHasError( _body = HUE_BLANK, _description = HUE_BLANK){
		if ( _body.length > 0 && (_body[0]).hasOwnProperty(HUE_ERROR_NODE) === true  ){
				
			let errorNode = _body[0].error;
			
			if (errorNode.hasOwnProperty(HUE_ERROR_DESC_ATTR) === true )
				return ({'isError':true,'exactMatch':(errorNode.description === _description), 'description':errorNode.description})
			else
				return ({'isError':true,'exactMatch':false, 'description':JSON.stringify(errorNode)});

		}else
			return ({'isError':false,'exactMatch':false, 'description':HUE_BLANK});

	}

	/**
	 *
	 *
	 *
	 *
	 */
	 unRegisteredUser () {
	 	// doesnt actually do this against the bridge - just in the lib.
	 	this.userStatus === HUE_USER_STATUS_REGISTER;
	 	this.userKey = null;
	 }


	 /**
	  *
	  *
	  * need a timeout again here, because when registering the user, the operator needs to put the button on
	  * top of the bridge. So we need to give them 30 seconds (at least to do this)
	  *
	  */
	registerUser ( _url = this.api_reg_url(), _headers = RESTFUL_API_STANDARD_POST_HEADER,  _payload = {}, _timeout = HUE_REGISTER_USER_TIMEOUT, fetchLightsOnSuccess = true) {

		console.log(`${_url} ${JSON.stringify(_headers)} ${JSON.stringify(_payload)} ${_timeout}`);
		if (!this.userStatus === HUE_USER_STATUS_REGISTERED)
			return;

		const func = `registerUser url:${_url}`;

		if ( _payload === {} || _payload === null )
			throw Error (`${func} - illegal payload ${JSON.stringify(_payload)}`);

		_headers.body = JSON.stringify(_payload);
		console.log(`${_url} ${JSON.stringify(_headers)} ${JSON.stringify(_payload)} ${_timeout}`);		
	
		const controller = new AbortController();
		const signal = controller.signal;
		const timeoutId = setTimeout(() => controller.abort(), _timeout);

		fetch(_url,_headers).then( response => {
			
			clearTimeout(timeoutId);
		
			if ( !response.ok || (response.status != 200 ))
				throw Error (`${func}- request failed ${response.url} : ${response.status} - ${response.statusText} `);

			return response.json();
		
		})
		.then( body => {

			const responseMeta = this.responseHasError(body, HUE_ERROR_LINKBUTTON_NOTPRESSES);

			if (responseMeta.isError && !responseMeta.exactMatch )
				throw Error (`${func} failed to register user, reason: ${responseMeta.description}`);

			else if ( responseMeta.isError && responseMeta.exactMatch)
				throw Error (`${func} - You must press the button ontop of the bridge before requesting user registration.`);
		
			
			if (body.length > 0 && (body[0]).hasOwnProperty(HUE_SUCCESS_NODE) === true ){
			
				const validResponse = body[0].success;
			
				if ( validResponse.hasOwnProperty(HUE_USERNAME_ATTR) === true)
					return validResponse.username;
			
				else
					throw Error (`${func} unexpected success payload -  ${JSON.stringify(body)}`);
			
			} else 
				throw Error (`${func} failed to register - unexpected response ${JSON.stringify(body)}`);
		
		})
		.then ( usrKey => {
		
			if (usrKey === null ){
		
				this.userStatus = HUE_USER_STATUS_REGISTER;
				console.log(`usr registration failed - using Hue bridge ${this.bridgeIPAddr} user must be registed userStatus = ${this.userStatus}`);
		
			} else {
		
				this.userKey = usrKey; //reassign the key in the class to be the value coming back from the service.
				this.userStatus = HUE_USER_STATUS_REGISTERED;
				console.log(`usr registration - using Hue bridge ${this.bridgeIPAddr} with key ${this.userKey} userStatus = ${this.userStatus}`);
				if (fetchLightsOnSuccess)
					this.getHueLights();
		
			}
			
		})
		.catch( err => {

			this.userStatus = HUE_USER_STATUS_FAILED;
			console.error( err )
	
		});


	}





	/**
	 *
	 *
	 *
	 *
	 */
	discovery ( _url = HUE_DISCOVERY_URL, _headers = RESTFUL_API_STANDARD_CORS_HEADER, _timeout = HUE_DISCOVERY_TIMEOUT ) {

		if ( this.discoveryStatus != HUE_DISCOVERY_STATUS_INIT && this.discoveryStatus != HUE_DISCOVERY_STATUS_FAILED)
			return;

		const func = `discovery url:${_url}`;
		const controller = new AbortController();
		const signal = controller.signal;
		const timeoutId = setTimeout(() => controller.abort(), _timeout);
		
		this.discoveryStatus = HUE_USER_STATUS_PENDING;

		fetch(_url,{signal},_headers)
			.then( response => {
				clearTimeout(timeoutId);
				if ( !response.ok || (response.status != 200 ))
					throw Error (`discovery - request failed ${response.url} : ${response.status} - ${response.statusText} `);

				return response.json();
			})
			.then( body => {

				if ( body.length > 0 )
					if ( (body[HUE_DEFAULT_BRIDGE]).hasOwnProperty(HUE_DEFAULT_IPADDR) === true ) 
						return body[HUE_DEFAULT_BRIDGE].internalipaddress;
					else 
						throw Error ("discovery - illegal bridge definition");
				else 
					throw Error ("discovery - failed to locate any bridges");
			
			})
			.then ( bridgeAddr => {
			
				this.bridgeIPAddr = bridgeAddr;
				this.discoveryStatus = HUE_DISCOVERY_STATUS_COMPLETE;
				console.log(`discovery - using Hue bridge ${this.bridgeIPAddr}`);
			
			})
			.catch( err => {
			
				this.discoveryStatus = HUE_DISCOVERY_STATUS_FAILED;
				console.error( err )
			
			});


	}

	/**
	 *
	 *
	 *
	 *
	 */
	getHueLights ( _headers = RESTFUL_API_STANDARD_CORS_HEADER, _timeout = HUE_DISCOVERY_TIMEOUT ) {

		if ( this.discoveryStatus != HUE_DISCOVERY_STATUS_COMPLETE || this.userStatus != HUE_USER_STATUS_REGISTERED)
			return;

		const url = this.api_lights_url();
		const func = `getLights url:${url}`;
		const controller = new AbortController();
		const signal = controller.signal;
		const timeoutId = setTimeout(() => controller.abort(), _timeout);
		
		this.hueLights = null;

		fetch(url,{signal},_headers)
			.then( response => {
				clearTimeout(timeoutId);
				if ( !response.ok || (response.status != 200 ))
					throw Error (`${func} - request failed ${response.url} : ${response.status} - ${response.statusText} `);

				return response.json();
			})
			.then( body => {

				const responseMeta = this.responseHasError(body, HUE_BLANK);

				if (responseMeta.isError  )
					throw Error (`${func} failed to get lights ${responseMeta.description}`);
		
				if (body.hasOwnProperty('1') === true )
					return body ; // lights object is numberd 1,2,3... JSON structure can differ depending on number of lights and the product
			
				else 
					throw Error (`${func} - unexpected response ${JSON.stringify(body)}`);
				
			})
			.then ( hueLights => {
				
				this.hueLights  = hueLights;
				//console.log(this.hueLights);
			})
			.catch( err => {
				console.error( err )
			});


	}

	generateRegisterPayload( _applicationName = HUE_BLANK, _usr = HUE_BLANK  ){
		if ( _applicationName === HUE_BLANK || _usr === HUE_BLANK)
			throw Error ("generateUserKey - unable to generate key as argument/s are blank");
		return ({
			"devicetype" : `${_applicationName}#${_usr}`
		});
	}

	generateLightStatePayload( _on = true){
		return ( {"on": _on} );
	}

	generateLightColorPayload( _hue = 0, _bri = 0, _sat = 0){
		return ( {"hue": _hue, "bri":_bri, "sat":_sat} );
	}

	makeUserKey( _applicationName = HUE_BLANK, _usr = HUE_BLANK  ){
		if ( _applicationName === HUE_BLANK || _usr === HUE_BLANK)
			throw Error ("makeUserKey - unable to generate key as argument/s are blank");
		return (`${_applicationName}#${_usr}`);
	}

	/**
	 *
	 *
	 *
	 *
	 */
	setHueLightState ( _lightId = "1", _payload = {}, _headers = RESTFUL_API_STANDARD_PUT_HEADER, _timeout = HUE_FAILFAST_TIMEOUT ) {

		if ( this.discoveryStatus != HUE_DISCOVERY_STATUS_COMPLETE || this.userStatus != HUE_USER_STATUS_REGISTERED)
			return;

		const url = this.api_setlights_url(_lightId);
		const func = `setHueLightState url:${url}`;
		const controller = new AbortController();
		const signal = controller.signal;
		const timeoutId = setTimeout(() => controller.abort(), _timeout);
		
		_headers.body = JSON.stringify(_payload);

		fetch(url,_headers)//todo add timeout
			.then( response => {
				clearTimeout(timeoutId);
				if ( !response.ok || (response.status != 200 ))
					throw Error (`${func} - request failed ${response.url} : ${response.status} - ${response.statusText} `);

				return response.json();
			})
			.then( body => {

				const responseMeta = this.responseHasError(body, HUE_BLANK);

				if (responseMeta.isError  )
					throw Error (`${func} failed to set light state. Header ${_headers} payload:${JSON.stringify(_payload)} error: ${responseMeta.description}`);
			
				if (body.length > 0 && (body[0]).hasOwnProperty(HUE_SUCCESS_NODE) === true ){
					const validResponse = body[0].success;
					return validResponse;
				}
			
				throw Error (`${func} - unexpected payload:${JSON.stringify(_payload)} - response ${JSON.stringify(body)}`);
				
			})
			.then ( successPayload => {
				
				//console.log(successPayload);
			})
			.catch( err => {
				console.error( err )
			});


	}
}




	/**
	 *
	 *
	 *
	 *
	 */
class Hue extends HueRestful {


	constructor( _usrKey = HUE_BLANK) {
		super(_usrKey);
		
		this.discovery ();
		
	}

	getBridge(){
		return ( this.bridgeIPAddr);
	}

	getUserKey (){
		return (this.userKey);
	}

	verifyUser () {
		this.isKeyValid( this.usr );
	}

	userRegistered() {
		//console.log(`userStatus:${this.userStatus}`);
		return ( this.userStatus === HUE_USER_STATUS_REGISTERED);
	}

	registerUserRequired() {
		//console.log(`userStatus:${this.userStatus}`);
		return ( this.userStatus === HUE_USER_STATUS_REGISTER);
	}

	registerNewUser(_appname, _usr) {
		this.registerUser(undefined,undefined,this.generateRegisterPayload(_appname,_usr));
	}

	HueEnabled() {
		return ( this.discoveryStatus === HUE_DISCOVERY_STATUS_COMPLETE);
	}

	hasLights() {
		//console.log(`has lights ${this.lights() !== undefined}`);
		return ( this.lights() !== undefined);
	}
	
	lights () {
		return  ( ( this.hueLights === undefined || this.hueLights === null || this.hueLights === HUE_BLANK) ? undefined : this.hueLights );
	}
	

}

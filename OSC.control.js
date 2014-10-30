// Written by Jürgen Moßgraber - mossgrabers.de
// (c) 2014
// Licensed under LGPLv3 - http://www.gnu.org/licenses/lgpl-3.0.txt

loadAPI (1);
load ("framework/helper/ClassLoader.js");
load ("framework/daw/ClassLoader.js");
load ("osc/ClassLoader.js");
load ("Config.js");

host.defineController ("Open Sound Control", "OSC", "1.11", "94DD41B0-EFEE-11E3-AC10-0800200C9A66", "Jürgen Moßgraber");
host.defineMidiPorts (1, 0);

var RECEIVE_HOST = '127.0.0.1';
var RECEIVE_PORT = 8000;
var SEND_HOST    = '127.0.0.1';
var SEND_PORT    = 9000;

var model = null;
var parser = null;
var writer = null;

String.prototype.getBytes = function () 
{
	var bytes = [];
	for (var i = 0; i < this.length; i++) 
		bytes.push (this.charCodeAt(i));
	return bytes;
};

function init ()
{
    Config.init ();

    var scales = new Scales (0, 128, 128, 1);
    scales.setChromatic (true);
	model = new Model (70, scales);
	
	parser = new OSCParser (model, RECEIVE_HOST, RECEIVE_PORT);
    writer = new OSCWriter (model, SEND_HOST, SEND_PORT);
    
    scheduleTask (function ()
    {
        writer.flush (true);
    }, null, 1000);
    
	println ("Initialized.");
}

function exit ()
{
}

function flush ()
{
    writer.flush ();
}

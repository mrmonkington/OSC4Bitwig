// Written by Jürgen Moßgraber - mossgrabers.de
// (c) 2014
// Licensed under LGPLv3 - http://www.gnu.org/licenses/lgpl-3.0.txt

OSCWriter.TRACK_ATTRIBS = [ "selected", "name", "volumeStr", "volume", "vu", "mute", "solo", "recarm", "monitor", "autoMonitor", "panStr", "pan", "sends", "slots" ];
OSCWriter.FXPARAM_ATTRIBS = [ "name", "valueStr", "value" ];

function OSCWriter (model, oscHost, oscPort)
{
    this.oscPort = oscPort;
    this.model   = model;
    
    this.oldValues = {};
    this.messages = [];
}

OSCWriter.prototype.flush = function (dump)
{
    //
    // Transport
    //

    var trans = this.model.getTransport ();
    this.sendOSC ('/play', trans.isPlaying, dump);
    this.sendOSC ('/record', trans.isRecording, dump);
    this.sendOSC ('/overdub', trans.isOverdub, dump);
    this.sendOSC ('/overdub/launcher', trans.isLauncherOverdub, dump);
    this.sendOSC ('/repeat', trans.isLooping, dump);
    this.sendOSC ('/click', trans.isClickOn, dump);
    this.sendOSC ('/tempo/raw', trans.getTempo (), dump);

    //
    // Master-/Track(-commands)
    //
    
	var tb = this.model.getTrackBank ();
	for (var i = 0; i < this.model.numTracks; i++)
        this.flushTrack ('/track/' + (i + 1) + '/', tb.getTrack (i), dump);
    this.flushTrack ('/master/', this.model.getMasterTrack (), dump);

    //
    // Device
    //
    
    var cd = this.model.getCursorDevice ();
    var selDevice = cd.getSelectedDevice ();
    this.sendOSC ('/device/name', selDevice.name, dump);
    this.sendOSC ('/device/bypass', !selDevice.enabled, dump);
	for (var i = 0; i < cd.numParams; i++)
    {
        var oneplus = i + 1;
        this.flushFX ('/device/param/' + oneplus + '/', cd.getFXParam (i), dump);
        this.flushFX ('/device/common/' + oneplus + '/', cd.getCommonParam (i), dump);
        this.flushFX ('/device/envelope/' + oneplus + '/', cd.getEnvelopeParam (i), dump);
        this.flushFX ('/device/macro/' + oneplus + '/', cd.getMacroParam (i), dump);
        this.flushFX ('/device/modulation/' + oneplus + '/', cd.getModulationParam (i), dump);
    }
    this.sendOSC ('/device/category', cd.categoryProvider.selectedItemVerbose, dump);
    this.sendOSC ('/device/creator', cd.creatorProvider.selectedItemVerbose, dump);
    this.sendOSC ('/device/preset', cd.presetProvider.selectedItemVerbose, dump);

    var user = this.model.getUserControlBank ();
	for (var i = 0; i < cd.numParams; i++)
        this.flushFX ('/user/param/' + (i + 1) + '/', user.getUserParam (i), dump);
    
    if (this.messages.length == 0)
    {
        this.messages = [];
        return;
	}
    
    while (msg = this.messages.shift ())
        host.sendDatagramPacket (Config.sendHost, Config.sendPort, msg);
};

OSCWriter.prototype.flushTrack = function (trackAddress, track, dump)
{
    for (var a = 0; a < OSCWriter.TRACK_ATTRIBS.length; a++)
    {
        var p = OSCWriter.TRACK_ATTRIBS[a];
        switch (p)
        {
            case 'sends':
                if (!track.sends)
                    continue;
                for (var j = 0; j < 6; j++)
                {
                    var s = track.sends[j];
                    for (var q in s)
                        this.sendOSC (trackAddress + 'send/' + j + '/' + q, s[q], dump);
                }
                break;
                
            case 'slots':
                if (!track.slots)
                    continue;
                for (var j = 0; j < 8; j++)
                {
                    var s = track.slots[j];
                    for (var q in s)
                        this.sendOSC (trackAddress + 'slot/' + j + '/' + q, s[q], dump);
                }
                break;
                
            default:
                this.sendOSC (trackAddress + p, track[p], dump);
                break;
        }
	}
};

OSCWriter.prototype.flushFX = function (fxAddress, fxParam, dump)
{
    for (var a = 0; a < OSCWriter.FXPARAM_ATTRIBS.length; a++)
    {
        var p = OSCWriter.FXPARAM_ATTRIBS[a];
        this.sendOSC (fxAddress + p, fxParam[p], dump);
	}
};

OSCWriter.prototype.sendOSC = function (address, value, dump)
{
    if (!dump && this.oldValues[address] === value)
        return;
    this.oldValues[address] = value;
    var msg = new OSCMessage ();
    msg.init (address, value);
    this.messages.push (msg.build ());
};

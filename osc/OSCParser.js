// Written by J�rgen Mo�graber - mossgrabers.de
// (c) 2014
// Licensed under LGPLv3 - http://www.gnu.org/licenses/lgpl-3.0.txt

function OSCParser (model, receiveHost, receivePort)
{
	this.model = model;
    
    this.transport = this.model.getTransport ();
    this.trackBank = this.model.getTrackBank ();
    this.masterTrack = this.model.getMasterTrack ();
    this.scales = this.model.getScales ();
    
    this.trackBank.setIndication (true);

    this.keysTranslation = null;
    this.drumsTranslation = null;
    this.updateNoteMapping ();
    
    this.port = host.getMidiInPort (0);
    this.noteInput = this.port.createNoteInput ("OSC Midi");
    
    host.addDatagramPacketObserver (receiveHost, receivePort, doObject (this, function (data)
    {
        var msg = new OSCMessage ();
        msg.parse (data);

        /*
        println ("Address: " + msg.address);
        println ("Types: " + msg.types);
        println ("Values: " + msg.values);
        */

        this.parse (msg);
    }));
}

OSCParser.prototype.parse = function (msg)
{
	var oscParts = msg.address.split ('/');
	oscParts.shift (); // Remove first empty element
	if (oscParts.length == 0)
		return;
        
    var value = msg.values == null ? null : msg.values[0];

	switch (oscParts.shift ())
	{
        //
        // Transport
        //
    
		case 'play':
            if (value == null || (value > 0 && !this.transport.isPlaying))
                this.transport.play ();
			break;

		case 'stop':
            if (value == null || (value > 0 && this.transport.isPlaying))
                this.transport.play ();
			break;

		case 'restart':
            if (value == null || value > 0)
                this.transport.restart ();
			break;

		case 'record':
            if (value == null || value > 0)
                this.transport.record ();
			break;

		case 'overdub':
            if (value != null && value == 0)
                return;
            if (oscParts.length > 0 && oscParts[0] == 'launcher')
                this.transport.toggleLauncherOverdub ();
            else
                this.transport.toggleOverdub ();
			break;

		case 'repeat':
            if (value == null)
                this.transport.toggleLoop ();
            else if (value > 0)
                this.transport.setLoop (value > 0);
			break;
		
		case 'click':
            if (value == null)
                this.transport.toggleClick ();
            else if (value > 0)
                this.transport.setClick (value > 0);
			break;
		
		case 'tempo':
			switch (oscParts[0])
            {
                case 'raw':
                    this.transport.setTempo (value);
                    break;
                case 'tap':
                    this.transport.tapTempo ();
                    break;
            }
			break;

		case 'time':
            this.transport.setPosition (value);
			break;

        //
        // Scenes
        //
    
        case 'scene':
            var p = oscParts.shift ();
            switch (p)
            {
                case '+':
                    if (value == null || value > 0)
                        this.trackBank.scrollScenesPageDown ();
                    break;
                case '-':
                    if (value == null || value > 0)
                        this.trackBank.scrollScenesPageUp ();
                    break;
                default:
                    var scene = parseInt (p);
                    if (!scene)
                        return;
                    switch (oscParts.shift ())
                    {
                        case 'launch':
                            this.trackBank.launchScene (scene - 1);
                            break;
                    }
                    break;
            }
            break;
            
        //
        // Master-/Track(-commands)
        //
    
		case 'track':
			var trackNo = parseInt (oscParts[0]);
			if (isNaN (trackNo))
            {
                this.parseTrackCommands (oscParts, value);
				return;
            }
			oscParts.shift ();
			this.parseTrackValue (trackNo - 1, oscParts, value);
			break;

		case 'master':
			this.parseTrackValue (-1, oscParts, value);
			break;
            
        //
        // Device
        //
    
        case 'device':
            if (value != null && value == 0)
                return;
            /* Currently, we only have the cursor device
			var fxNo = parseInt (oscParts[0]);
			if (isNaN (fxNo))
				return;
			oscParts.shift ();*/
            this.parseDeviceValue (oscParts, value);
            break;
            
        //
        // Keyboard
        //
    
        case 'vkb_midi':
            this.parseMidi (oscParts, value);
            break;
		
        //
        // Indicators
        //
        
        case 'indicate':
            var p = oscParts.shift ();
            var isVolume = p === 'volume';
            var isParam  = p === 'param';
            var isMacro  = p === 'macro';
            var tb = this.model.getCurrentTrackBank ();
            var cd = this.model.getCursorDevice ();
            var mt = this.model.getMasterTrack ();
            for (var i = 0; i < 8; i++)
            {
                cd.getParameter (i).setIndication (isParam);
                cd.getMacro (i).getAmount ().setIndication (isMacro);
                tb.setVolumeIndication (i, isVolume);
                tb.setPanIndication (i, isVolume);
                mt.setVolumeIndication (isVolume);
            }
            break;
    
		default:
			println ('Unhandled OSC Command: ' + msg.address + ' ' + value);
			break;
	}
};

OSCParser.prototype.parseTrackCommands = function (parts, value)
{
    if (value != null && value == 0)
        return;

	switch (parts[0])
 	{
        case 'bank':
            parts.shift ();
            if (parts.shift () == '+')
            {
                if (!this.trackBank.canScrollTracksDown ())
                    return;
                this.trackBank.scrollTracksPageDown ();
                scheduleTask (doObject (this, this.selectTrack), [ 0 ], 75);
            }
            else // '-'
            {
                if (!this.trackBank.canScrollTracksUp ())
                    return;
                this.trackBank.scrollTracksPageUp ();
                scheduleTask (doObject (this, this.selectTrack), [ 7 ], 75);
            }
            break;
            
        case '+':
            var sel = this.trackBank.getSelectedTrack ();
            var index = sel == null ? 0 : sel.index + 1;
            if (index == 8)
            {
                if (!this.trackBank.canScrollTracksDown ())
                    return;
                this.trackBank.scrollTracksPageDown ();
                scheduleTask (doObject (this, this.selectTrack), [0], 75);
            }
            this.selectTrack (index);
            break;
            
        case '-':
            var sel = this.trackBank.getSelectedTrack ();
            var index = sel == null ? 0 : sel.index - 1;
            if (index == -1)
            {
                if (!this.trackBank.canScrollTracksUp ())
                    return;
                this.trackBank.scrollTracksPageUp ();
                scheduleTask (doObject (this, this.selectTrack), [7], 75);
                return;
            }
            this.selectTrack (index);
            break;
            
        case 'add':
            switch (parts[1])
            {
                case 'audio': this.model.getApplication ().addAudioTrack (); break;
                case 'effect': this.model.getApplication ().addEffectTrack (); break;
                case 'instrument': this.model.getApplication ().addInstrumentTrack (); break;
            }
            break;
            
		default:
			println ('Unhandled Track Command: ' + parts[0]);
			break;
    }
};

OSCParser.prototype.parseTrackValue = function (trackIndex, parts, value)
{
    var p = parts.shift ();
	switch (p)
 	{
		case 'select':
            if (value && value == 0)
                return;
            if (trackIndex == -1)
                this.masterTrack.select ();
            else
                this.trackBank.select (trackIndex);
			break;
			
		case 'volume':
            if (parts.length == 0)
            {
				var volume = parseFloat (value);
                if (trackIndex == -1)
                    this.masterTrack.setVolume (volume);
                else
                    this.trackBank.setVolume (trackIndex, volume);
            }
			break;
			
		case 'pan':
			if (parts.length == 0)
            {
				var pan = value;
                if (trackIndex == -1)
                    this.masterTrack.setPan (pan);
                else
                    this.trackBank.setPan (trackIndex, pan);
            }
			break;
			
		case 'mute':
			var mute = value == null ? null : parseInt (value);
            if (trackIndex == -1)
            {
                if (mute == null)
                    this.masterTrack.toggleMute ();
                else
                    this.masterTrack.setMute (mute > 0);
            }
            else
            {
                if (mute == null)
                    this.trackBank.toggleMute (trackIndex);
                else
                    this.trackBank.setMute (trackIndex, mute > 0);
			}
            break;
			
		case 'solo':
			var solo = value == null ? null : parseInt (value);
            if (trackIndex == -1)
            {
                if (solo == null)
                    this.masterTrack.toggleSolo ();
                else
                    this.masterTrack.setSolo (solo > 0);
            }
            else
            {
                if (solo == null)
                    this.trackBank.toggleSolo (trackIndex);
                else
                    this.trackBank.setSolo (trackIndex, solo > 0);
			}
            break;
			
		case 'recarm':
			var recarm = value == null ? null : parseInt (value);
            if (trackIndex == -1)
            {
                if (recarm == null)
                    this.masterTrack.toggleArm ();
                else
                    this.masterTrack.setArm (recarm > 0);
            }
            else
            {
                if (recarm == null)
                    this.trackBank.toggleArm (trackIndex);
                else
                    this.trackBank.setArm (trackIndex, recarm > 0);
			}
            break;
            
		case 'monitor':
			var monitor = value == null ? null : parseInt (value);
            var isAuto = parts.length > 0 && parts[0] == 'auto';
            if (trackIndex == -1)
            {
                if (monitor == null)
                    if (isAuto)
                        this.masterTrack.toggleAutoMonitor ();
                    else
                        this.masterTrack.toggleMonitor ();
                else
                    if (isAuto)
                        this.masterTrack.setAutoMonitor (monitor > 0);
                    else
                        this.masterTrack.setMonitor (monitor > 0);
            }
            else
            {
                if (monitor == null)
                    if (isAuto)
                        this.trackBank.toggleAutoMonitor (trackIndex);
                    else
                        this.trackBank.toggleMonitor (trackIndex);
                else
                    if (isAuto)
                        this.trackBank.setAutoMonitor (trackIndex, monitor > 0);
                    else
                        this.trackBank.setMonitor (trackIndex, monitor > 0);
            }
			break;

		case 'autowrite':
            // Note: Can only be activated globally
            this.transport.toggleWriteArrangerAutomation ();
			break;
			
		case 'send':
			var sendNo = parseInt (parts.shift ());
			if (isNaN (sendNo))
				return;
			this.parseSendValue (trackIndex, sendNo - 1, parts, value);
			break;
            
        case 'clip':
			var clipNo = parseInt (parts.shift ());
			if (isNaN (clipNo))
				return;
            switch (parts.shift ())
            {
                case 'launch':
                    this.trackBank.getClipLauncherSlots (trackIndex).launch (clipNo - 1);
                    break;
            }
			break;
            
		default:
			println ('Unhandled Track Parameter: ' + p);
			break;
	}
};

OSCParser.prototype.parseSendValue = function (trackIndex, sendIndex, parts, value)
{
	switch (parts[0])
 	{
		case 'volume':
            this.trackBank.setSend (trackIndex, sendIndex, value);
			break;

        default:
			println ('Unhandled Send Parameter value: ' + parts[0]);
			break;
	}
};

OSCParser.prototype.parseDeviceValue = function (parts, value)
{
    var cd = this.model.getCursorDevice ();
    
    var p = parts.shift ();
    switch (p)
    {
		case 'bypass':
            this.model.getCursorDevice ().toggleEnabledState ();
			break;
			
		case 'openui':
            // Can not open VST UIs...
			break;

		case 'param':
			var part = parts.shift ();
            var paramNo = parseInt (part);
			if (isNaN (paramNo))
            {
                if (value == null || value > 0)
                {
                    switch (part)
                    {
                        case '+':
                            cd.nextParameterPage ();
                            break;
                        case '-':
                            cd.previousParameterPage ();
                            break;
                    }
                }
				return;
            }
			this.parseFXParamValue (paramNo - 1, parts, value);
			break;
    
        case '+':
            if (value == null || value > 0)
                cd.selectNext ();
            break;

        case '-':
            if (value == null || value > 0)
                cd.selectPrevious ();
            break;

        case 'preset':
            if (value == null || value > 0)
            {
                switch (parts.shift ())
                {
                    case '+':
                        cd.switchToNextPreset ();
                        break;
                    case '-':
                        cd.switchToPreviousPreset ();
                        break;
                }
            }
            break;

        case 'category':
            if (value == null || value > 0)
            {
                switch (parts.shift ())
                {
                    case '+':
                        cd.switchToNextPresetCategory ();
                        break;
                    case '-':
                        cd.switchToPreviousPresetCategory ();
                        break;
                }
            }
            break;

        case 'creator':
            if (value == null || value > 0)
            {
                switch (parts.shift ())
                {
                    case '+':
                        cd.switchToNextPresetCreator ();
                        break;
                    case '-':
                        cd.switchToPreviousPresetCreator ();
                        break;
                }
            }
            break;

        default:
			println ('Unhandled Device Parameter: ' + p);
			break;
    }
};

OSCParser.prototype.parseFXParamValue = function (fxparamIndex, parts, value)
{
	switch (parts[0])
 	{
		case 'value':
			if (parts.length == 1)
				this.model.getCursorDevice ().setParameter (fxparamIndex, parseFloat (value));
			break;

        default:
			println ('Unhandled FX Parameter value: ' + parts[0]);
			break;
	}
};

OSCParser.prototype.parseMidi = function (parts, value)
{
    var midiChannel = parseInt (parts.shift ());
    var p = parts.shift ();
    switch (p)
    {
        case 'note':
            var n = parts.shift ();
            switch (n)
            {
                case '+':
                    if (value == null || value > 0)
                    {
                        this.scales.incOctave ();
                        this.updateNoteMapping ();
                        displayNotification (this.scales.getRangeText ());
                    }
                    break;
            
                case '-':
                    if (value == null || value > 0)
                    {
                        this.scales.decOctave ();
                        this.updateNoteMapping ();
                        displayNotification (this.scales.getRangeText ());
                    }
                    break;
            
                default:
                    var note = parseInt (n);
                    var velocity = parseInt (value);
                    this.noteInput.sendRawMidiEvent (0x90 + midiChannel, this.keysTranslation[note], velocity);
            }
            break;
            
        case 'drum':
            var n = parts.shift ();
            switch (n)
            {
                case '+':
                    if (value == null || value > 0)
                    {
                        this.scales.incDrumOctave ();
                        this.updateNoteMapping ();
                        displayNotification (this.scales.getDrumRangeText ());
                    }
                    break;
            
                case '-':
                    if (value == null || value > 0)
                    {
                        this.scales.decDrumOctave ();
                        this.updateNoteMapping ();
                        displayNotification (this.scales.getDrumRangeText ());
                    }
                    break;
            
                default:
                    var note = parseInt (n);
                    var velocity = parseInt (value);
                    this.noteInput.sendRawMidiEvent (0x90 + midiChannel, this.drumsTranslation[note], velocity);
                    break;
            }
            break;
            
        default:
			println ('Unhandled Midi Parameter: ' + p);
            break;
    }
};

OSCParser.prototype.updateNoteMapping = function ()
{
    this.drumsTranslation = this.scales.getDrumMatrix ();
    this.keysTranslation = this.scales.getNoteMatrix (); 
};

OSCParser.prototype.selectTrack = function (index)
{
    this.trackBank.select (index);
};

qx.Class.define("desk.actions", 
{
	extend : qx.core.Object,

	construct : function(fileBrowser)
	{
		this.base(arguments);
		desk.actions.ACTIONSHANDLER=this;
		this.__actionMenu = new qx.ui.menu.Menu;
		this.populateActionMenu();
		this.__menuButton=new qx.ui.menu.Button("Actions", null , null, this.__actionMenu);

		if (fileBrowser!=null)
			this.__fileBrowser=fileBrowser;
		else
			this.__fileBrowser=new desk.fileBrowser();

		var ongoingActions = new qx.ui.form.List().set({
			width: 200
	//		height: 400
		});
		this.__ongoingActions=ongoingActions;
		qx.core.Init.getApplication().getRoot().add(ongoingActions, { right : 0, top : 0});
		return this;
	},

	events : {
		"loadedmenu" : "qx.event.type.Event"
	},

	statics : {
		ACTIONHANDLER : null
	},

	members : {
		__actionsFile : "/visu/desk/actions.xml",
		__actionMenu : null,
		__actions : null,
		__menuButton : null,
		__fileBrowser : null,
		__ongoingActions : null,

		__actionsList : null,

		getButton : function()
		{
			return (this.__menuButton);
		},

		launchAction : function (actionParameters, successCallback, context)
		{
			var actionNotification=new qx.ui.basic.Label(actionParameters["action"]);
			this.__ongoingActions.add(actionNotification);
			var req = new qx.io.request.Xhr();
			req.setUrl("/visu/desk/php/actions.php");
			req.setMethod("POST");
			req.setAsync(true);
			req.setRequestData(actionParameters);
			req.addListener("success", onSuccess, this);
			req.send();
			
			function onSuccess (e){
				this.__ongoingActions.remove(actionNotification);
				successCallback.call(context,e);
			}

		},

		populateActionMenu : function()
		{
			var xmlhttp=new XMLHttpRequest();
			xmlhttp.open("GET",this.__actionsFile+"?nocache=" + Math.random(),false);
			xmlhttp.send();
			this.__actions=xmlhttp.responseXML;
			var actions=this.__actions.getElementsByTagName("action");
			var actionMenu=this;

			for (var n=0;n<actions.length;n++)
			{
				var action=actions[n];
				var actionName=action.getAttribute("name");
				var button=new qx.ui.menu.Button(actionName);
				button.addListener("click", function (e){
			//	console.log(desk.fileBrowser.ACTIVEFILEBROWSER);
					actionMenu.createActionWindow(this.getLabel(), null, desk.fileBrowser.ACTIVEFILEBROWSER);});
				this.__actionMenu.add(button);
			}
			this.fireEvent("loadedmenu");
			console.log("fired");
		},

		createActionWindowFromURL : function (fileURL)
		{
			var req = new qx.io.request.Xhr(fileURL);
			req.addListener("success", function(e) {
				var req = e.getTarget();
				var parametersText=req.getResponseText();
				var parameters=[];
				var splitParameters=parametersText.split("\n");
				for (var i=0 ; i!=splitParameters.length;i++)
				{
					var splitString=splitParameters[i].split("=");
					parameters[splitString[0]]=splitString[1];
				}
				this.createActionWindow(parameters["action"],parameters);
			}, this);
			req.send();
		},

		createActionWindow : function (actionName, providedParameters, fileBrowser)
		{
			var action=this.__actions.getElementsByName(actionName)[0];
			
			var actionWindow=new qx.ui.window.Window();
			actionWindow.setLayout(new qx.ui.layout.HBox());
			var pane = new qx.ui.splitpane.Pane("horizontal");
			var outputDirectory=null;

//			actionWindow.setHeight(300);
			actionWindow.setWidth(300);
			actionWindow.setShowClose(true);
			actionWindow.setShowMinimize(false);
			actionWindow.setUseMoveFrame(true);
			actionWindow.setCaption(action.getAttribute("name"));

			var parametersBox = new qx.ui.container.Composite;
			parametersBox.setLayout(new qx.ui.layout.VBox());
			pane.add(parametersBox);
			actionWindow.add(pane, {flex : 1});

			// create the form manager
			var manager = new qx.ui.form.validation.Manager();
			actionWindow.open();

			var intValidator = function(value, item) {
				var parameterName=this.getAttribute("name");
				if ((value==null) || (value==""))
				{
					if (this.getAttribute("required")=="true")
					{
						item.setInvalidMessage("\""+parameterName+"\" is empty");
						return (false);
					}
				}
				else if ( (parseInt(value)!=parseFloat(value))||
						 isNaN(value)){
					item.setInvalidMessage("\""+parameterName+"\" should be an integer");
					return (false);
				}
				return (true);
				};

			var floatValidator = function(value, item) {
				var parameterName=this.getAttribute("name");
				if ((value==null) || (value==""))
				{
					if (this.getAttribute("required")=="true")
					{
						item.setInvalidMessage("\""+parameterName+"\" is empty");
						return (false);
					}
				}
				else if (isNaN(value)){
					item.setInvalidMessage("\""+parameterName+"\" should be a number");
					return (false);
				}
				return (true);
				};

			var stringValidator = function(value, item) {
				var parameterName=this.getAttribute("name");
				if (parameterName=="output_directory")
					outputDirectory=value;
				if ((value==null) || (value==""))
				{
					if (this.getAttribute("required")=="true")
					{
						item.setInvalidMessage("\""+parameterName+"\" is empty");
						return (false);
					}
				}
				else if (value.split(" ").length!=1){
					item.setInvalidMessage("\""+parameterName+"\" should contain no space characters");
					return (false);
				}
				return (true);
				};

			var fileAlreadyPickedFromBrowser=false;

			var parameters=action.getElementsByTagName("parameter");
			for (var i=0;i<(parameters.length+1);i++)
			{
				var parameter;
				if (i==parameters.length)
				{
					// insert output directory parameter by default
					parameter=document.createElement("parameter");
					parameter.setAttribute('name',"output_directory");
					parameter.setAttribute('type',"directory");
					parameter.setAttribute('required',"true");
				}
				else
					parameter=parameters[i];

				var parameterName=parameter.getAttribute("name");
				parametersBox.add(new qx.ui.basic.Label(parameterName));
				var parameterForm=new qx.ui.form.TextField();
				parameterForm.setPlaceholder(parameterName);
				parametersBox.add(parameterForm);
				var parameterType=parameter.getAttribute("type");

				switch (parameterType)
				{
				case "int":
					manager.add(parameterForm, intValidator, parameter);
					break;
				case "string":
					manager.add(parameterForm, stringValidator, parameter);
					break;
				case "float":
					manager.add(parameterForm, floatValidator, parameter);
					break;
				case "file":
					if ((!fileAlreadyPickedFromBrowser) && (fileBrowser!=null))
					{
						fileAlreadyPickedFromBrowser=true;
						parameterForm.setValue(fileBrowser.getNodePath(
							fileBrowser.getSelectedNode()));
					}
					parameterForm.setDroppable(true);
					parameterForm.addListener("drop", function(e) {
							var fileBrowser=e.getData("fileBrowser");
							var fileNode=fileBrowser.getSelectedNode();
 							this.setValue(fileBrowser.getNodePath(fileNode));
						}, parameterForm);

					manager.add(parameterForm, stringValidator, parameter);
					break;
				case "directory":
					if (fileBrowser!=null)
					{
						var fileNode=fileBrowser.getSelectedNode();
						if (fileNode.type==
							qx.ui.treevirtual.MTreePrimitive.Type.LEAF)
						{					
							var parentNode=fileBrowser.getTree().nodeGet(
								fileNode.parentNodeId);
							parameterForm.setValue(fileBrowser.getNodePath(parentNode));
						}
						else
						{
							parameterForm.setValue(fileBrowser.getNodePath(fileNode))
						}
					}
					parameterForm.setDroppable(true);
					parameterForm.addListener("drop", function(e) {
							var fileBrowser=e.getData("fileBrowser");
							var fileNode=fileBrowser.getSelectedNode();
 							this.setValue(fileBrowser.getNodePath(fileNode));
						}, parameterForm);

					manager.add(parameterForm, stringValidator, parameter);
					break;
				default :
						alert("no validator implemented for type : "+parameterType);
				}

				if (providedParameters!=null)
				{
					var providedParameterValue=providedParameters[parameterName];
					if (providedParameterValue!=null)
						parameterForm.setValue(providedParameterValue);
				}

				parameterForm.addListener("input", function(e) 
					{this.setInvalidMessage(null);},parameterForm);
			}

			var send = new qx.ui.form.Button("Process");
			parametersBox.add(send);//, {left: 20, top: 215});
			send.addListener("execute", function() {
				// return type can not be used because of async validation
				manager.validate()
				}, this);

			var displayOutputOnOff = new qx.ui.form.CheckBox("Show log");
			displayOutputOnOff.setVisibility("excluded");
			parametersBox.add(displayOutputOnOff);
			displayOutputOnOff.setValue(false);

			var embededFileBrowser=null;

			var phpOutputTextArea = new qx.ui.form.TextArea();
			phpOutputTextArea.setVisibility("excluded");
			parametersBox.add(phpOutputTextArea, {flex : 1});
			displayOutputOnOff.addListener("changeValue", function (e) {
					if (displayOutputOnOff.getValue()==true)
						phpOutputTextArea.setVisibility("visible");
					else
						phpOutputTextArea.setVisibility("excluded");});


			// add a listener to the form manager for the validation complete
			manager.addListener("complete", function() {
				// check the validation status
				if (manager.getValid()) {
					// configure the send button
					send.setEnabled(false);
					send.setLabel("Processing...");
					var parameterMap={"action" : actionName};
					var items=manager.getItems();
					for (var i=0;i<items.length;i++)
					{
						var currentItem=items[i];
						var value=currentItem.getValue();
						if (value!=null)
							parameterMap[currentItem.getPlaceholder()]=value;
					}

					this.launchAction (parameterMap, getAnswer, this)
					function getAnswer(e)
					{
				// configure the send button
						send.setEnabled(true);
						send.setLabel("Update");

						var req = e.getTarget();
						var response=req.getResponseText();
						displayOutputOnOff.setVisibility("visible");
						phpOutputTextArea.setValue(response);

						if (embededFileBrowser==null)
						{
							//display the results directory
				//			embededFileBrowser=new desk.fileBrowser(pane, outputDirectory);
						}
					}
				} else {
					alert(manager.getInvalidMessages().join("\n"));
				}
				}, this);
		}
	}
});

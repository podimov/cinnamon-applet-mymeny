const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Gio = imports.gi.Gio;
const Gettext = imports.gettext;
const UUID = "mymenu@podimov";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str);
}

function MyApplet(metadata, orientation) {
    this._init(metadata, orientation);
};

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.set_applet_tooltip(_("My menu"));

        try {
            this.set_applet_icon_name("view-refresh");
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);
            this.appletPath = metadata.path;
            this.gsettings = Gio.Settings.new("org.gnome.desktop.default-applications.terminal");
            this.homeDir = GLib.get_home_dir();
            this.sshConfig = this.homeDir + "/.local/share/cinnamon/applets/" + UUID + "/config";
            this.msgSource = new MessageTray.SystemNotificationSource(_("My menu"));
            Main.messageTray.add(this.msgSource);
            let file = Gio.file_new_for_path(this.sshConfig);
            this.monitor = file.monitor_file(Gio.FileMonitorFlags.NONE, new Gio.Cancellable());
            this.monitor.connect("changed", Lang.bind(this, this.updateMenu));
            this.updateMenu();
        }
        catch (e) {
            global.logError(e);
        }
    },

    updateMenu: function() {
        this.menu.removeAll();

        try {
            let [res, out, err, status] = GLib.spawn_command_line_sync('grep "^Action|" .local/share/cinnamon/applets/' + UUID + '/config');
            if(out.length !== 0) {
                let actions = out.toString().split("\n");
                for(let i=0; i<actions.length; i++) {
                    let action = actions[i];
                    if(action !== "") {
                        let actionAndCommandArray = action.split('|');
                        let actionName = actionAndCommandArray[1];
                        let command = actionAndCommandArray[2];
                        let item = new PopupMenu.PopupMenuItem(actionName);
                        item.connect('activate', Lang.bind(this, function() { this.doAction(actionName, command); }));
                        this.menu.addMenuItem(item);
                    }
                }
            }
        } catch(e) {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("ERROR. ") + e, { reactive: false }));
        }
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        let menuitemEdit = new PopupMenu.PopupMenuItem(_("Edit config"));
        menuitemEdit.connect('activate', Lang.bind(this, this.editConfig));
        this.menu.addMenuItem(menuitemEdit);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    },

    doAction: function(actionName, command) {
        let terminal = this.gsettings.get_string("exec");
        Main.Util.spawnCommandLine(terminal + " -T \"" + command + "\" -e \" " + command + "\"");
        let notification = new MessageTray.Notification(this.msgSource, _("My menu"), _("Executed ") + actionName);
        notification.setTransient(true);
        this.msgSource.notify(notification);
        sleep();
    },

    editConfig: function() {
        GLib.spawn_command_line_async(this.appletPath + "/launch_editor.sh");
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}

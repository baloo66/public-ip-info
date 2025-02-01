// cinnamon-applet-wireguard - https://github.com/nicoulaj/cinnamon-applet-wireguard
// copyright (c) 2019 cinnamon-applet-wireguard contributors
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
// ----------------------------------------------------------------------

const Applet = imports.ui.applet;
const Lang = imports.lang;
const Soup = imports.gi.Soup; // for making https requests
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib; // for translation
const Gettext = imports.gettext;
const ModalDialog = imports.ui.modalDialog; // for error handling

const UUID = "public-ip-info@eller-software.de";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "./local/share/locale");

function _(str) {
    return Gettext.dgettext(UUID, str)
}


const PublicIPAddressApplet = class PublicIPAddressApplet extends Applet.IconApplet {
    
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this._orientation = orientation;
        this._menu_manager = null;
        this._menu = null;
        this._refreshTimer = null;

        this.ipv4 = _("?");
        this.ipv6 = _("?");

        this._ipv4menu = null;
        this._ipv6menu = null;

        this.set_applet_icon_name("icon");
        this.set_applet_tooltip(_("Public-IP-Address"));
    }

    on_applet_added_to_panel(userEnabled) {
        if (!this._menu_manager) {
            this._menu_manager = new PopupMenu.PopupMenuManager(this);
            this._menu = new Applet.AppletPopupMenu(this, this._orientation);
            this._menu_manager.addMenu(this._menu);
            
            // first item
            let item = new PopupMenu.PopupMenuItem(_("refresh"));
            item.connect('activate', Lang.bind(this, this._onRefreshActivate));
            this._menu.addMenuItem(item);

            // second item
            this._ipv4menu = new PopupMenu.PopupMenuItem(this.ipv4);
            this._menu.addMenuItem(this._ipv4menu);

            this._ipv6menu = new PopupMenu.PopupMenuItem(this.ipv6);
            this._menu.addMenuItem(this._ipv6menu);

            this._startRefreshTimer();
        }
        this._onRefreshActivate();
    }

    on_applet_removed_from_panel(deleteConfig) {
        this._stopRefreshTimer();
        if (this._menu_manager) {
            this._menu_manager.removeMenu(this._menu);
            this._menu = null;
            this._menu_manager = null;
        }
    }

    on_applet_clicked(event) {
        if (this._menu) {
            this._menu.toggle();
        }
    }

    _startRefreshTimer() {
        if (this._refreshTimer) {
            return;
        }   
        this._refreshTimer = setInterval(Lang.bind(this, this._onRefreshActivate), 5000);
    }
    
    _stopRefreshTimer() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = null;
        }
    }

    _onRefreshActivate() {
        global.log("refreshing ...");
        this._get_public_ip_addresses();
    }

    _handle_error(msg, details = null, fatal = true) {
        let formatted = msg;

        if (details)
            formatted += "\n\n" + _("Error details") + ":\n" + details;

        global.logError(formatted);

        new ModalDialog.NotifyDialog(formatted).open();

        if (fatal) {
            this.on_applet_removed_from_panel();
            this.set_applet_tooltip(msg);
        }
    }


    _update_display() {
        global.log("aktuell IPv4 " + this.ipv4 + " / IPv6 " + this.ipv6);
        this._ipv4menu.label.set_text(this.ipv4 || "N/A"); // Update menu items
        this._ipv6menu.label.set_text(this.ipv6 || "N/A");
    }

    _get_public_ip_addresses() {
        this.ipv4 = "N/A";
        this.ipv6 = "N/A";
        this._fetchIPWithTimeout("https://api4.ipify.org?format=plain", (ip) => {
            global.log("callback ipv4");
            this.ipv4 = ip || _("unknown");
            this._update_display();
        });
        this._fetchIPWithTimeout("https://api6.ipify.org?format=plain", (ip) => {
            global.log("callback ipv6-1");
            if (ip) {
                this.ipv6 = ip;
                this._update_display();
            } else {
                this._fetchIPWithTimeout("https://v6.ident.me/", (ip) => { // Fallback to v6.ident.me
                    global.log("callback ipv6-2");
                    this.ipv6 = ip || _("unknown");
                    this._update_display();
                });
            }
        });
    }
       

    _fetchIPWithTimeout(url, callback) {
        let session = new Soup.Session();
        let message = Soup.Message.new('GET', url);
        session.send_and_read_async(message, Soup.MessagePriority.NORMAL, null, (session, res) => {
            global.log("in reading " + url);
            try {
                let response = session.send_and_read_finish(res);
                if (message.status_code === 200) {
                    callback(response.get_data().toString());
                } else {
                    callback(null);
                }
            } catch (error) {
                global.logError(`Failed to fetch IP: ${error}`);
                callback(null);
            }
        });
    }

}


function main(metadata, orientation) {
    return new PublicIPAddressApplet(orientation);
}

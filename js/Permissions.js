/* global BootstrapDialog, EnvironmentData, Tree, userPermissions */

var ClassPermissions = function ()
{
    /**
     * @description Muestra el panel de permisos del grupo seleccionado.
     * @param {type} idGroup
     * @param {type} userGroupName
     * @returns {undefined}
     */
    this.showPermissionsPanel = function (idGroup, userGroupName)
    {
        var self = this;

        var tabbable = $('<div>');

        var navTab = $('<ul>', {class: "nav nav-tabs"});

        var adminUnitLi = $('<li>', {class: "active"}).append('<a href="#userGroupsPermissions" data-toggle="tab"><i class="fa fa-cogs fa-lg"></i> Permisos</a>');

        var userGroupsPermissions = $('<div>', {class: "tab-pane active", id: "userGroupsPermissions"});

        var tabContent = $('<div>', {class: "tab-content"});

        var content = $('<div>');
        content.append('<center><i class="fa fa-spinner fa-spin fa-lg"></i></center>');
        
        var repositoryTree = $('<div>', {id: "repositoriesTree"});
        
        content.append(repositoryTree);
        
        var permissionsTreeRepositories = $('<div>', {id: "permissionsTree"});

        content.append(permissionsTreeRepositories);
        
        var systemPermissionsTree = $('<div>', {id: 'systemPermissionsTree'});
        
        content.append(systemPermissionsTree);

        userGroupsPermissions.append(content);

        tabContent.append(userGroupsPermissions);

        navTab.append(adminUnitLi);

        tabbable.append(navTab);
        tabbable.append(tabContent);

        BootstrapDialog.show({
            title: 'Control de Permisos para el grupo <b>' + userGroupName + '</b>',
            size: BootstrapDialog.SIZE_NORMAL,
            type: BootstrapDialog.TYPE_PRIMARY,
            message: tabbable,
            closable: true,
            closeByBackdrop: false,
            buttons: [
                {
                    label: "Aplicar",
                    cssClass: "btn-primary",
                    action: function (dialogRef) {
                        var button = this;
                        button.spin();
                        button.disable();

                        _ApplyPermissionsSettings(idGroup);

                        button.stopSpin();
                        button.enable();
                    }
                }
            ],
            onshown: function (dialogRef) {              
            
                var reporisoty = new ClassRepository();
                var xmlRepositories = reporisoty.GetRepositories(0);
                
                var permissions = _getSystemPermissions();
                
                if(!$.isXMLDoc(permissions))
                    return Advertencia("No fue posible obtener los permisos del sistema");
                
                _buildRepositoryPermissionsTree();
                _buildRepositoriesTree(idGroup, userGroupName, xmlRepositories, dialogRef);
                _buildSystemPermissionsTree();  
                _setSystemPermissions(permissions);
                
                var rootNode = $('#repositoriesTree').dynatree("getTree").getNodeByKey('MSR_0');
                
                if(rootNode !== null){
                    var RepositoryChildren = rootNode.getChildren();
                    if ($.isArray(RepositoryChildren) && RepositoryChildren.length > 0)
                        RepositoryChildren[0].activate();               /* Se activa el primer repositorio */
                    else{
                        Advertencia("Debe agregar por lo menos un repositorio para realizar asignación de permisos.");
                        dialogRef.close();    
                    }
                }
                                     
                content.find('.fa-spinner').remove();
                
            },
            onclose: function (dialogRef) {

            }
        });

    };
    
/**
 * @description Obtiene el listado de permisos disponibles en el sistema
 * @returns {xml Xml con el listado de permisos.}
 */
    var _getSystemPermissions = function ()
    {
        var permissions = null;
        $.ajax({
            async: false,
            cache: false,
            dataType: "html",
            type: 'POST',
            url: "php/Permissions.php",
            data: 'opcion=getSystemPermissions',
            success: function (xml)
            {
                if ($.parseXML(xml) === null) 
                    return errorMessage(xml);
                else
                    xml = $.parseXML(xml);

                if ($(xml).find("Menu").length > 0) 
                    permissions = xml;

                $(xml).find("Error").each(function (){
                    var $Error = $(this);
                    var mensaje = $Error.find("Mensaje").text();
                    errorMessage(mensaje);
                });

            },
            beforeSend: function () {
            },
            error: function (jqXHR, textStatus, errorThrown) {
                errorMessage(textStatus + "<br>" + errorThrown);
            }
        });
        
        return permissions;
    };
    
    /**
     * @description Construye el árbol de Repositorios.
     * @returns {undefined}
     */
    var _buildRepositoriesTree = function(idGroup, userGroupName, xmlRepositories, dialogRef){
        $('#repositoriesTree').dynatree({
            generateIds: false, 
            expand: true, 
            selectMode: 3, 
            checkbox: true, 
            children: [{
                    key: 'MSR_0',
                    icon: 'Catalogo.png',
                    isFolder: true,
                    title: 'Repositorios',
                    idRepository: 0
            }],
            onClick: function (node, event) {
                if (node.getEventTargetType(event) === "checkbox")
                    node.activate();
                
                if (node.getEventTargetType(event) === "title")
                    if (!node.bSelected)
                        node.toggleSelect();
                
                node.sortChildren(cmp, false);
                
                
            },
            onActivate: function (node, event){
                node.sortChildren(cmp, false);
                
                var repositoryPermissionsRoot = $('#permissionsTree').dynatree('getTree').getNodeByKey("0");
                if(repositoryPermissionsRoot !== null){
                    if(parseInt(node.data.idRepository) > 0){
                        repositoryPermissionsRoot.data.title = "Permisos de "+node.data.title;
                        repositoryPermissionsRoot.render();
                    }
                    else{
                        repositoryPermissionsRoot.data.title = "Elija Repositorio";
                        repositoryPermissionsRoot.render();
                    }
                }
                
                _GetAccessPermissionsListOfRepository(node, idGroup, userGroupName);   /* Obtiene los permisos sobre el repositorio */     
                
            },
            onCreate: function (node, event)
            {
                node.sortChildren(cmp, false);
            }
        });
        
        $(xmlRepositories).find("Repository").each(function () {
            var IdRepositorio = $(this).find('IdRepositorio').text();
            var Nombre = $(this).find('NombreRepositorio').text();
            var ClaveEmpresa = $(this).find('ClaveEmpresa').text();
            var child = {
                key: 'MSR_' + IdRepositorio,
                isFolder: true,
                icon: 'Repositorio.png',
                title: Nombre,
                enterpriseKey: ClaveEmpresa,
                idRepository: IdRepositorio,
                expand: true
            };

            $('#repositoriesTree').dynatree("getTree").getNodeByKey('MSR_0').addChild(child);
        });
        
        var RepositoriesTree = $('#repositoriesTree').dynatree("getTree");  /* crea el árbol izquierdo (repositorios)*/
                
        if(!typeof RepositoriesTree === 'object'){
            return Advertencia("No fue posible obtener la estructura de repositorios.");
        }

        _GetRepositoryAccessList(RepositoriesTree, idGroup, userGroupName);    /* Permisos de acceso (check) árbol izquierdo (repositorios)*/
        
        return 1;
    };
    
    var _buildRepositoryPermissionsTree = function(){
        $('#permissionsTree').dynatree({
            generateIds: false, 
            selectMode: 3, 
            checkbox: true, 
            expand: true, 
            minExpandLevel: 3,
            children: [{
                    title: 'Permisos de Repositorio',
                    idPermission: 0,
                    isFolder: true,
                    idParent: 0,
                    key: 0,
                    icon: 'cogwheel.png',
                    type: 1
            }],
            onClick: function (node, event) {
                node.sortChildren(cmp, false);
//                if (node.getEventTargetType(event) !== "title")
//                    node.toggleSelect();
            },
            onKeydown: function (node, event) {
                if (event.which === 32) {
                    node.toggleSelect();
                    return false;
                }
            }
        });

        var node = $("#permissionsTree").dynatree("getActiveNode");
        
        if (node !== null)
            node.sortChildren(cmp, false);

        return 1;
    };
    
    var _buildSystemPermissionsTree = function ()
    {
        $('#systemPermissionsTree').dynatree({
            generateIds: false, 
            selectMode: 3, 
            checkbox: true, 
            expand: true, 
            minExpandLevel: 3,
            children: [{
                    title: 'Permisos del Sistema',
                    idPermission: 0,
                    isFolder: true,
                    idParent: 0,
                    key: 0,
                    icon: 'cogwheel.png',
                    type: 0
            }],
            onClick: function (node, event) {
                node.sortChildren(cmp, false);
//                if (node.getEventTargetType(event) !== "title")
//                    node.toggleSelect();
            },
            onKeydown: function (node, event) {
                if (event.which === 32) {
                    node.toggleSelect();
                    return false;
                }
            }
        });
        
    };


    /*---------------------------------------------------------------------------
     * @description Regresa los accesos a los repositorios a los cuales el grupo seleccionado
     * tiene permiso de acceso
     * 
     * @param {type} RepositoriesTree
     * @returns {undefined}
     ---------------------------------------------------------------------------*/
    var _GetRepositoryAccessList = function (RepositoriesTree, idUserGroup, userGroupName)
    {

        $.ajax({
            async: false,
            cache: false,
            dataType: "html",
            type: 'POST',
            url: "php/Permissions.php",
            data: 'opcion=GetRepositoryAccessList&idUserGroup=' + idUserGroup + '&userGroupName=' + userGroupName,
            success: function (xml)
            {
                if ($.parseXML(xml) === null) 
                    return errorMessage(xml);
                else
                    xml = $.parseXML(xml);

                $(xml).find("Repository").each(function ()
                {
                    var IdRepository = $(this).find('IdRepositorio').text();
                    var node = RepositoriesTree.getNodeByKey("MSR_" + IdRepository);
                    
                    if(node !== null)
                        if (!node.bSelected)
                            node.toggleSelect();
                });

                $(xml).find("Error").each(function ()
                {
                    var mensaje = $(this).find("Mensaje").text();
                    errorMessage(mensaje);
                    $('#UsersPlaceWaiting').remove();
                });

            },
            beforeSend: function () {
            },
            error: function (jqXHR, textStatus, errorThrown) {
                errorMessage(textStatus + "<br>" + errorThrown);
            }
        });
    };
    
    var _setSystemPermissions = function(xml){
        $(xml).find("Menu").each(function (){
            var IdMenu = $(this).find("IdMenu").text();
            var IdParent = $(this).find("IdParent").text();
            var Nombre = $(this).find("Nombre").text();
            var type = $(this).find('Type').text();
            
            var child = {
                title: Nombre,
                isFolder: true,
                idPermission: IdMenu,
                key: IdMenu,
                icon: 'cogwheel.png',
                idParent: IdParent
            };
            
             var parent = null;
            if(parseInt(type) === 1)
                parent = $('#permissionsTree').dynatree('getTree').getNodeByKey(IdParent);
            else if(parseInt(type) === 0)
                parent = $('#systemPermissionsTree').dynatree('getTree').getNodeByKey(IdParent);
                
                if(parent !== null)
                    parent.addChild(child);
            
            
        });
    };

    var _GetAccessPermissionsListOfRepository = function (node, idUserGroup, userGroupName)
    {
        var IdRepositorio = node.data.idRepository;
        
        if (!(parseInt(IdRepositorio) > 0))
            return 0;
        
        var PermissionsTree = $("#permissionsTree").dynatree("getTree");
        var systemPermissionsTree = $('#systemPermissionsTree').dynatree('getTree');
        
        if(systemPermissionsTree === null)
            return Advertencia("No fue posible obtener la estructura de permisos del sistema");
        
        if(PermissionsTree === null)
            return Advertencia("No se pudo obtener la estructura de permisos por repositorio.");
        
        var root = PermissionsTree.getNodeByKey("0");

        if ($.type(root) === 'object')
            if (!root.bSelected){
                root.toggleSelect();
                root.toggleSelect();
            } else
                root.toggleSelect();

        $.ajax({
            async: false,
            cache: false,
            dataType: "html",
            type: 'POST',
            url: "php/Permissions.php",
            data: 'opcion=GetAccessPermissionsList&IdRepositorio=' + IdRepositorio + '&NombreRepositorio=' + node.data.title + '&IdGrupo=' + idUserGroup + '&NombreGrupo=' + userGroupName,
            success: function (xml)
            {
                if ($.parseXML(xml) === null) 
                    return errorMessage(xml);
                else
                    xml = $.parseXML(xml);

                $(xml).find("Menu").each(function (){
                    var IdMenu = $(this).find('IdMenu').text();
                    var type = $(this).find('Type').text();
                    var node = null;
               
                    if(parseInt(type) === 0)
                        node = systemPermissionsTree.getNodeByKey(IdMenu);
                    else if (parseInt(type) === 1)
                        node = PermissionsTree.getNodeByKey(IdMenu);
            
                    if(node !== null){
                        var idParent = node.data.idParent;
                        if (!node.bSelected && (node.getChildren() === null) > 0)
                            node.toggleSelect();
                    }
                });

                $(xml).find("Error").each(function (){
                    var mensaje = $(this).find("Mensaje").text();
                    errorMessage(mensaje);
                    $('#UsersPlaceWaiting').remove();
                });

            },
            beforeSend: function () {
            },
            error: function (jqXHR, textStatus, errorThrown) {
                errorMessage(textStatus + "<br>" + errorThrown);
            }
        });
    };

    var _ApplyPermissionsSettings = function (idGroup)
    {
        
        var node = $("#repositoriesTree").dynatree("getActiveNode");
        
        if(node === null)
            return Advertencia("No fue posible obtener la estructura de repositorios para aplicar los permisos.");
        
        var IdRepositorio = node.data.idRepository;
        var NombreRepositorio = node.data.title;

        if (!parseInt(IdRepositorio) > 0)
            return Advertencia("Debe seleccionar un repositorio.");

        if (!parseInt(idGroup) > 0)
            return Advertencia("No fue posible obtener el identificador del grupo seleccionado para aplicar los permisos");
        
        var permissionsTree = $('#permissionsTree').dynatree('getTree');
        var systemPermissionsTree = $('#systemPermissionsTree').dynatree('getTree');
  
        var permissionsTreeSelectedNodes = [];
        var SelectedRepositoriesTree = Tree.GetSelectedNodes('#repositoriesTree');
        var UnselectedRepositories = Tree.GetUncheckNodes('#repositoriesTree');
        var UnselectedMenus = [];
        var SettingsXml = undefined;
         
        permissionsTree.visit(function(node){          
            if(node.hasSubSel && !node.bSelected){
                if(parseInt(node.data.idPermission) > 0)
                    permissionsTreeSelectedNodes.push(node);
            }
            else if(node.bSelected)
                permissionsTreeSelectedNodes.push(node);
            else if( !node.bSelected) {
                UnselectedMenus.push(node);
            }
        });
        
        systemPermissionsTree.visit(function(node){          
            if(node.hasSubSel && !node.bSelected){
                if(parseInt(node.data.idPermission) > 0)
                    permissionsTreeSelectedNodes.push(node);
            }
            else if(node.bSelected)
                permissionsTreeSelectedNodes.push(node);
            else if( !node.bSelected) 
                UnselectedMenus.push(node);
        });
        
        SettingsXml = "<Settings version='1.0' encoding='UTF-8'>";

        $.each(SelectedRepositoriesTree, function (){
            var Id = this.data.idRepository;

            SettingsXml += "<AccessToTheRepository>";
            SettingsXml += "<IdRepository>" + Id + '</IdRepository>';
            SettingsXml += "<RepositoryTitle>" + this.data.title + '</RepositoryTitle>';
            SettingsXml += "</AccessToTheRepository>";
        });

        $.each(UnselectedRepositories, function ()
        {
            var Id = this.data.idRepository;

            SettingsXml += "<WithoutAccessToTheRepository>";
            SettingsXml += "<IdRepository>" + Id + '</IdRepository>';
            SettingsXml += "<RepositoryTitle>" + this.data.title + '</RepositoryTitle>';
            SettingsXml += "</WithoutAccessToTheRepository>";
        });
        
        $.each(permissionsTreeSelectedNodes, function ()
        {
            var Id = this.data.idPermission;

            SettingsXml += "<AccessMenu>";
            SettingsXml += "<IdMenu>" + Id + '</IdMenu>';
            SettingsXml += "<MenuTitle>" + this.data.title + '</MenuTitle>';
            SettingsXml += '</AccessMenu>';
        });

        $.each(UnselectedMenus, function ()
        {
            var Id = this.data.idPermission;
            
            SettingsXml += "<WithoutAccessMenu>";
            SettingsXml += "<IdMenu>" + Id + '</IdMenu>';
            SettingsXml += "<MenuTitle>" + this.data.title + '</MenuTitle>';
            SettingsXml += '</WithoutAccessMenu>';
        });

        SettingsXml += "</Settings>";

        $.ajax({
            async: true,
            cache: false,
            dataType: "html",
            type: 'POST',
            url: "php/Permissions.php",
            data: 'opcion=ApplyPermissionsSettingsOfGroup&IdRepositorio=' + IdRepositorio + '&NombreRepositorio=' + NombreRepositorio + '&IdGrupo=' + idGroup + '&SettingsXml=' + SettingsXml,
            success: function (xml)
            {
                if ($.parseXML(xml) === null) {
                    $('#UsersPlaceWaiting').remove();
                    errorMessage(xml);
                    return 0;
                } else
                    xml = $.parseXML(xml);

                $(xml).find("ApplySettings").each(function ()
                {
                    var Mensaje = $(this).find("Mensaje").text();
                    Notificacion(Mensaje);
                });

                $(xml).find("SystemError").each(function ()
                {
                    var mensaje = $(this).find("Mensaje").text();
                    Notificacion(mensaje);
                    $('#UsersPlaceWaiting').remove();
                });

                $(xml).find("Error").each(function ()
                {
                    var mensaje = $(this).find("Mensaje").text();
                    errorMessage(mensaje);
                    $('#UsersPlaceWaiting').remove();
                });
            },
            beforeSend: function () {
            },
            error: function (jqXHR, textStatus, errorThrown) {
                $('#UsersPlaceWaiting').remove();
                errorMessage(textStatus + "<br>" + errorThrown);
            }
        });

    };

    var cmp = function (a, b) {
        a = a.data.title.toLowerCase();
        b = b.data.title.toLowerCase();
        return a > b ? 1 : a < b ? -1 : 0;
    };

    this.ApplyUserPermissions = function (IdRepositorio)
    {
        var Permissions = _GetUserPermissions(IdRepositorio);
        if ($.type(Permissions) !== 'object')
            return 0;

        var HtmlNamePermission = new Array();
        var AccessPermissions = new Array();
        var DeniedPermissions = new Array();

        $(Permissions).find('DeniedPermissions').each(function ()
        {
            DeniedPermissions[DeniedPermissions.length] = [$(this).find('IdMenu').text(), $(this).find('Nombre').text()];
        });

        $(Permissions).find('AccessPermissions').each(function ()
        {
            AccessPermissions[AccessPermissions.length] = [$(this).find('IdMenu').text(), $(this).find('Nombre').text()];
        });

        $(Permissions).find('HtmlPermissionsName').each(function ()
        {
            HtmlNamePermission[$(this).find('Nombre').text()] = $(this).find('HtmlPermissionName').text();
        });

//        console.log(HtmlNamePermission);

        for (var cont = 0; cont < DeniedPermissions.length; cont++)
        {
            var IdMenu = DeniedPermissions[cont][0];
            var NombreMenu = DeniedPermissions[cont][1];

            if (HtmlNamePermission[NombreMenu] !== undefined)
            {
                var HtmlPermissionName = "." + HtmlNamePermission[NombreMenu];
                $(HtmlPermissionName).hide();
//                console.log(HtmlPermissionName+" Denegado...");
            } else
                console.log("No se encontró en el diccionario de menús a " + NombreMenu);
        }

        for (var cont = 0; cont < AccessPermissions.length; cont++)
        {
            var IdMenu = AccessPermissions[cont][0];
            var NombreMenu = AccessPermissions[cont][1];
            if (HtmlNamePermission[NombreMenu] !== undefined)
            {
                var HtmlPermissionName = "." + HtmlNamePermission[NombreMenu];
                $(HtmlPermissionName).show();
//                console.log(HtmlPermissionName+" Permitido...");
            } else
                console.log("No se encontró en el diccionario de menús a " + NombreMenu);
        }


        return 1;
    };

    _GetUserPermissions = function (IdRepositorio)
    {
        var Permissions = new Array();

        $.ajax({
            async: false,
            cache: false,
            dataType: "html",
            type: 'POST',
            url: "php/Permissions.php",
            data: 'opcion=GetUserPermissions&IdRepositorio=' + IdRepositorio,
            success: function (xml)
            {
                if ($.parseXML(xml) === null) {
                    return errorMessage(xml);
                } else
                    xml = $.parseXML(xml);

                if ($(xml).find("Error").length > 0)
                {
                    $(xml).find("Error").each(function ()
                    {
                        var $Error = $(this);
                        var estado = $Error.find("Estado").text();
                        var mensaje = $Error.find("Mensaje").text();
                        errorMessage(mensaje);
                    });
                } else
                    Permissions = xml;
            },
            beforeSend: function () {
            },
            error: function (jqXHR, textStatus, errorThrown) {
                errorMessage(textStatus + "<br>" + errorThrown);
            }
        });

        return Permissions;
    };

    /**
     * @description Devuelve el listado de permisos a los que tiene acceso el usuario.
     * @returns {undefined}
     */
    this.getAllUserPermissions = function () {
        var permissions;
        $.ajax({
            async: false,
            cache: false,
            dataType: "html",
            type: 'POST',
            url: "php/Permissions.php",
            data: {opcion: 'getAllUserPermissions'},
            success: function (xml){
                if ($.parseXML(xml) === null) 
                    return errorMessage(xml);
                else
                    xml = $.parseXML(xml);
                
                if ($(xml).find('permissions').length > 0)
                    permissions = xml;
                
                $(xml).find("Error").each(function (){
                    var $Error = $(this);
                    var estado = $Error.find("Estado").text();
                    var mensaje = $Error.find("Mensaje").text();
                    errorMessage(mensaje);
                });
            },
            beforeSend: function () {
            },
            error: function (jqXHR, textStatus, errorThrown) {
                errorMessage(textStatus + "<br>" + errorThrown);
            }
        });
        
        return permissions;
    };
};

function validateSystemPermission(repository, menu, type){
    var status = 0;
    repository = md5(repository);
    type = md5(type);
    
    $(userPermissions).find('permission').each(function(){
        if (type === 'cfcd208495d565ef66e7dff9f98764da'){
            if($(this).find('type').text() === type){
                if($(this).find('menu').text() === menu){
                    console.log($(this).find('menu').text()+" encontrado en repositorio "+repository);
                    return status = 1;
                }
            }
        }
        else if (type === 'c4ca4238a0b923820dcc509a6f75849b')
            if($(this).find('repository').text() === repository){
                if($(this).find('menu').text() === menu){
                    console.log($(this).find('menu').text()+" encontrado en repositorio "+repository);
                    return status = 1;
                }
            }
    });
    
    return status;
}


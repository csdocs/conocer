<?php


/**
 *
 * @author daniel
 */
require_once 'DataBase.php';
require_once 'XML.php';
require_once 'Fifo.php';
require_once "Log.php";
require_once 'Session.php';
$RoutFile = dirname(getcwd()); 
class Tree {
    public function __construct() {
        $this->ajax();
    }
    private function ajax()
    {
        
        if(filter_input(INPUT_POST, "opcion")!=NULL and filter_input(INPUT_POST, "opcion")!=FALSE){
            
            $idSession = Session::getIdSession();
        
            if($idSession == null)
                return XML::XMLReponse ("Error", 0, "Tree:No existe una sesión activa, por favor vuelva a iniciar sesión");
            
            $userData = Session::getSessionParameters();
            
            switch (filter_input(INPUT_POST, "opcion"))
            {
                case 'getTree': $this->get_tree($userData); break;
                case 'InsertDir': $this->InsertDir($userData); break;      
                case 'ModifyDir': $this->ModifyDir($userData); break;
                case 'DeleteDir': $this->DeleteDir(); break; 
                case 'GetListReposity': $this->GetListReposity($userData); break; 
            }
        }
    }
    /****************************************************************************
     *  Devuelve el listado de Empresas con sus respectivos repositorios
     * En un array para ser mostrados como un arbol
     * GetListReposity() Y ReturnXmlEmpresasRepository() se relacionan
     */
    function GetListReposity($userData)
    {
        $BD = new DataBase();
        $DataBaseName = $userData['dataBaseName'];
    
        $query = "SELECT re.IdRepositorio, re.NombreRepositorio, em.IdEmpresa, em.NombreEmpresa, em.ClaveEmpresa from CSDocs_Repositorios re INNER JOIN CSDocs_Empresas em ON em.ClaveEmpresa = re.ClaveEmpresa";
        $queryResult = $BD->ConsultaSelect($DataBaseName, $query);
        
        if($queryResult['Estado'] != 1)
            return XML::XMLReponse("Error", 0, "<p><b>Error</b> al obtener la estructura de empresas y repositorios</p> Detalles: <br> ".$queryResult['Estado']);
        
        $repositories = $queryResult['ArrayDatos'];
        
        (count($repositories)>0)?$this->ReturnXmlEmpresasRepository($repositories):XML::XMLReponse("Advertencia", 0, "No existen repositorios para mostrar");
            
    }
    
    function ReturnXmlEmpresasRepository($Estructura)
    {
        $doc  = new DOMDocument('1.0','utf-8');
        $doc->formatOutput = true;
        $root = $doc->createElement("Tree");
        $doc->appendChild($root); 
        for($cont=0;$cont<count($Estructura);$cont++)
        {
            $Empresa=$doc->createElement("Empresas");
            $Repositorios=$doc->createElement("Repositorios");                
            $IdRepositorio=$doc->createElement("IdRepositorio",$Estructura[$cont]['IdRepositorio']);                                
            $Repositorios->appendChild($IdRepositorio);
            $NombreRepositorio=$doc->createElement("NombreRepositorio",$Estructura[$cont]['NombreRepositorio']);
            $Repositorios->appendChild($NombreRepositorio);
            $EmpresaClaveEmpresa=$doc->createElement("EmpresaClaveEmpresa",$Estructura[$cont]['ClaveEmpresa']);
            $Repositorios->appendChild($EmpresaClaveEmpresa);
            $NombreEmpresa=$doc->createElement("NombreEmpresa",$Estructura[$cont]['NombreEmpresa']);
            $Empresa->appendChild($NombreEmpresa);
            $IdEmpresa=$doc->createElement("IdEmpresa",$Estructura[$cont]['IdEmpresa']);
            $Empresa->appendChild($IdEmpresa);
            $ClaveEmpresa=$doc->createElement("ClaveEmpresa",$Estructura[$cont]['ClaveEmpresa']);
            $Empresa->appendChild($ClaveEmpresa);
            $root->appendChild($Empresa);
            $root->appendChild($Repositorios);

        }
        header ("Content-Type:text/xml");
        echo $doc->saveXML();
    }
/***************************************************************************/
/***************************************************************************/    
    
    function get_tree($userData) 
    {
        $DataBaseName = $userData['dataBaseName'];
        $NombreRepositorio = filter_input(INPUT_POST, "NombreRepositorio");       
        
        $right = $this->getDirectoriesArray($DataBaseName, $NombreRepositorio);
                       
        if(!is_array($right))
            return XML::XMLReponse ("Error", 0, "Error al intentar recuperar la estructura de directorios. $right");
        
        XML::XmlArrayResponse("directories", "Directory", $right);
                             
    }
    
    function getDirectoriesArray($dataBaseName, $repositoryName){
        $DB = new DataBase();
        
        $query = "SELECT dir.*, doc.Name FROM dir_$repositoryName dir 
                LEFT JOIN CSDocs_DocumentaryDisposition doc ON dir.idDocDisposition = doc.idDocumentaryDisposition 
                LEFT JOIN auto_$repositoryName auto ON auto.id_expedient = dir.IdDirectory";
        
        $queryResult = $DB->ConsultaSelect($dataBaseName, $query);
        
        if($queryResult['Estado']!=1)
            return $queryResult['Estado'];
        
        return $queryResult['ArrayDatos'];
        
    }
    
    function InsertDir($userData)
    {
               
        $DataBaseName = $userData['dataBaseName'];
        $NombreRepositorio = filter_input(INPUT_POST, "repositoryName");       
        $NameDirectory = filter_input(INPUT_POST, "NameDirectory");
        $NombreUsuario = $userData['userName'];
        $IdUsuario = $userData['idUser'];
        $Path = filter_input(INPUT_POST, "Path");   
        $RoutFile = dirname(getcwd());
        $idDocDisposition = filter_input(INPUT_POST, "idDocDisposition");
        $catalogKey = filter_input(INPUT_POST, "catalogKey");
        $isLegajo = filter_input(INPUT_POST, "isLegajo");
        $isExpedient = filter_input(INPUT_POST, "isExpedient");
        $isFrontPage = filter_input(INPUT_POST, "isFrontPage");
        $idSerie = filter_input(INPUT_POST, "parentSerie");
        $templateName = filter_input(INPUT_POST, "templateName");
        $PathFinal = dirname($Path)."/";
        $IdParentDirectory = basename($PathFinal);
        
        if(!is_numeric($isExpedient))
            $isExpedient = 0;
        if(!is_numeric($isFrontPage))
            $isFrontPage = 0;
        if(!is_numeric($isFrontPage))
            $isFrontPage = 0;
        if(!(int)$idSerie > 0)
            $idSerie = 0;
        
        $autoincremenet = 0;
        if((int)$idSerie > 0 && (int)$isFrontPage > 0){
            $autoincremenet = $this->getExpedientAutoincrement($DataBaseName, $NombreRepositorio, $idSerie);
            if(!(int) $autoincremenet > 0)
                return XML::XMLReponse ("Error", 0, "<p>No fue posible obtener el valor autoincremental del expediente.</p>$autoincremenet");
            $NameDirectory = $NameDirectory.$autoincremenet;
        }
        
        $ultimo_id = $this->addNewDirectory($DataBaseName, $NombreRepositorio, $NameDirectory, $IdParentDirectory, $PathFinal, $idDocDisposition, $catalogKey,$isLegajo, $isExpedient, $isFrontPage, $autoincremenet, $templateName);    
           
        if(is_numeric($ultimo_id))
            $PathFinal.=$ultimo_id;
        else
            return XML::XMLReponse ("Error", 0, $ultimo_id);
        
        $RutaBase = "$RoutFile/Estructuras/$DataBaseName/$NombreRepositorio/$PathFinal";
        
        mkdir("$RutaBase",0777,true);
                                
        $doc  = new DOMDocument('1.0','utf-8');
        $doc->formatOutput = true;
        $root = $doc->createElement("Tree");
        $doc->appendChild($root); 
        $NuevoDir=$doc->createElement("NewDirectory");
        $IdNewDir=$doc->createElement("IdNewDir",$ultimo_id);
        $NuevoDir->appendChild($IdNewDir);
        $autoincremenetXml = $doc->createElement("autoincrement", $autoincremenet);
        $NuevoDir->appendChild($autoincremenetXml);
        $root->appendChild($NuevoDir);
        header ("Content-Type:text/xml");
        echo $doc->saveXML();
        
        Log::WriteEvent("18", $IdUsuario, $NombreUsuario, $NameDirectory, $DataBaseName);
        
    }
    
    function addNewDirectory($dataBaseMame, $repositoryName, $dirname, $idParent, $path, $idDocDisposition = null, $catalogKey = null, $isLegajo = null, $isExpedient = 0, $isFrontPage = 0, $autoincrement = 0, $templateName = ""){
        $DB = new DataBase();

        $Insert = "INSERT INTO dir_$repositoryName(parent_id,title, path, idDocDisposition, catalogKey, isLegajo, isExpedient, isFrontPage, autoincrement, templateName) VALUES "
                . "($idParent,'$dirname','$path', $idDocDisposition, '$catalogKey', $isLegajo, $isExpedient, $isFrontPage, $autoincrement, '$templateName')";            
        
        if(!(($resultInsert = $DB->ConsultaInsertReturnId($dataBaseMame, $Insert))>0))
                return "<p><b>Error</b> al agregar el directorio</p><br>".$resultInsert. "<br>".$Insert;
        
        return (int)$resultInsert;    
        
    }
    
    private function getExpedientAutoincrement($instanceName, $repositoryName, $idDirectory){
        $db = new DataBase();
        $update = "UPDATE dir_$repositoryName SET autoincrement = autoincrement + 1 WHERE IdDirectory = $idDirectory";
        if(($resUpdate = $db->ConsultaQuery($instanceName, $update)) != 1)
                return $resUpdate;
        $select = "SELECT autoincrement FROM dir_$repositoryName WHERE IdDirectory = $idDirectory";
        $resSelect = $db->ConsultaSelect($instanceName, $select);
        if($resSelect['Estado'] != 1)
            return $resSelect['Estado'];
        if(isset($resSelect['ArrayDatos'][0]['autoincrement']))
            return $resSelect['ArrayDatos'][0]['autoincrement'];
        else
            return 0;
        
        
    }
    
   function returnTreeXML($ArrayTree)
   {
       /* Devuelve un XML con la estructura de directorios obtenida de la BD */
       $XML=new XML();
       
       $Error=0;
       
        $doc  = new DOMDocument('1.0','utf-8');
        libxml_use_internal_errors(true);
        $doc->formatOutput = true;
        $root = $doc->createElement("Tree");
        $doc->appendChild($root); 
        for($cont=0;$cont<count($ArrayTree);$cont++)
        {
            $Directorio=$doc->createElement("Directory");
            $titulo=$doc->createElement("Title",$ArrayTree[$cont]['title']);
            $Directorio->appendChild($titulo);
            $Id=$doc->createElement("IdDirectory",$ArrayTree[$cont]['IdDirectory']);
            $Directorio->appendChild($Id);
            $IdParent=$doc->createElement("IdParent",$ArrayTree[$cont]['parent_id']);
            $Directorio->appendChild($IdParent);             
            $errors=libxml_get_errors();
            
            // Aquí se manejan los errores} 
            for ($aux=0;$aux<count($errors); $aux++) {                
                $Error.=$XML->display_xml_error($errors[$aux]);                
            }
            
            if(count($errors)>0){libxml_clear_errors();  /* Se limpia buffer de errores */continue;}
            else
                $root->appendChild($Directorio);                                              
        }       
        
        
        if($Error!==0)
        {
//            $XML->ResponseXML("Error", 0, "Ocurrió un error durante la construcción del árbol, es posible que no se hayan cargado todos los directorios debido a: $Error.");
            $Error_=$doc->createElement("Error");
            $Estado=$doc->createElement("Estado",0);
            $Error_->appendChild($Estado);
            $Mensaje=$doc->createElement("Mensaje",$Error);
            $Error_->appendChild($Mensaje);
            $root->appendChild($Error_);
                    
        }
        
        header ("Content-Type:text/xml");
        echo $doc->saveXML();
   }
   
   function DeleteDir() {
        $Fifo = new Fifo();
        $Log = new Log();
        $estado = TRUE;

        $IdRepositorio = filter_input(INPUT_POST, "IdRepositorio");
        $DataBaseName = filter_input(INPUT_POST, "DataBaseName");
        $NombreRepositorio = filter_input(INPUT_POST, "NombreRepositorio");
        $NameDirectory = filter_input(INPUT_POST, "NameDirectory");
        $NombreUsuario = filter_input(INPUT_POST, "nombre_usuario");
        $IdEmpresa = filter_input(INPUT_POST, "IdEmpresa");
        $IdDirectory = filter_input(INPUT_POST, "IdDirectory");
        $IdParent = filter_input(INPUT_POST, 'IdParent');
        $Path = filter_input(INPUT_POST, "Path");
        $title = filter_input(INPUT_POST, "title");
        $IdUsuario = filter_input(INPUT_POST, "IdUsuario");
        $XMLResponse = filter_input(INPUT_POST, "XMLResponse");
        $qdelete = '';
        $xml = simplexml_load_string($XMLResponse);
        $RoutFile = dirname(getcwd()); 
        if (count($xml->Directory) > 0) {
            foreach ($xml->Directory as $delete) {
                $qdelete.=" OR IdDirectory=$delete";
            }
        }

        /* Se registra el Id del directorio a eliminar */
        if (!file_exists("$RoutFile/Configuracion/DeleteDirectory/$DataBaseName/$NombreUsuario")) {
            if (!($mkdir = mkdir("$RoutFile/Configuracion/DeleteDirectory/$DataBaseName/$NombreUsuario", 0777, true))) 
                return XML::XMLReponse("Error", 0, "No se pudo crear el directorio en <b>Configuracion/$DataBaseName/$NombreUsuario</b> <br><br>Detalles:$mkdir");
        }

        if (file_exists("$RoutFile/Configuracion/DeleteDirectory/$DataBaseName/$NombreUsuario/DeleteDirectory.ini"))
            unlink("$RoutFile/Configuracion/DeleteDirectory/$DataBaseName/$NombreUsuario/DeleteDirectory.ini");

        $archivo = "$RoutFile/Configuracion/DeleteDirectory/$DataBaseName/$NombreUsuario/DeleteDirectory.ini";
        $config = fopen($archivo, "a+");
        if (!($config)) 
            return XML::XMLReponse("Error", 0, "Error al crear archivo de configuración.<br><br>Detalles:<br><br>$config");

        fwrite($config, "; Archivo que contiene el directorio a eliminar y sus subdirectorios. " . PHP_EOL);
        fwrite($config, "[DeleteDirectory]" . PHP_EOL);
        fwrite($config, "DataBaseName=$DataBaseName" . PHP_EOL);
        fwrite($config, "NombreRepositorio=$NombreRepositorio" . PHP_EOL);
        fwrite($config, "IdRepositorio=$IdRepositorio" . PHP_EOL);
        fwrite($config, "NameDirectory=$NameDirectory" . PHP_EOL);
        fwrite($config, "IdEmpresa=$IdEmpresa" . PHP_EOL);
        fwrite($config, "IdDirectory=$IdDirectory" . PHP_EOL);
        fwrite($config, "IdParent=$IdParent" . PHP_EOL);
        fwrite($config, "IdUsuario=$IdUsuario" . PHP_EOL);
        fwrite($config, "NombreUsuario=$NombreUsuario" . PHP_EOL);
        fwrite($config, "title=$title" . PHP_EOL);
        fwrite($config, "PathDirectory=$Path" . PHP_EOL);
//        fwrite($config, "QueryDelete[]=$query".PHP_EOL);    
        fwrite($config, "; Direcoties=> IdDirectory, IdParent, title " . PHP_EOL);
        fwrite($config, "[Directories]" . PHP_EOL);
        /* Registro de subdirectorios */
        if (count($xml->Directory) > 0) {
            foreach ($xml->Directory as $delete) {
                fwrite($config, "Directory[]=" . $delete->IdDirectory . "###" . $delete->IdParent . "###" . $delete->title . "###" . $delete->Path . PHP_EOL);
            }
        }

        fclose($config);

        $KeyProcess = $Fifo->AddToStack("DeleteDirectory", $NombreUsuario, $archivo);
        if ($KeyProcess === 0) 
            return XML::XMLReponse("Error", 0, "Error al registrar el proceso.");

        rename($archivo, dirname($archivo) . "/$KeyProcess.ini");

        $StartProcess = $Fifo->StartProcess($KeyProcess);

        if ($StartProcess == 0) 
            return XML::XMLReponse("Error", 0, "No pudo inicializarse el proceso de borrado del directorio <b>$title</b>");

        $Log->Write("20", $IdUsuario, $NombreUsuario, $NameDirectory, $DataBaseName);

        $doc = new DOMDocument('1.0', 'utf-8');
        libxml_use_internal_errors(true);
        $doc->formatOutput = true;
        $root = $doc->createElement("DeleteDir");
        $doc->appendChild($root);
        $Estado = $doc->createElement("Estado", $estado);
        $root->appendChild($Estado);
        $Mensaje = $doc->createElement("Mensaje", "<p>Iniciando Proceso de Borrado del directorio <b>$NameDirectory</b></p>");
        $root->appendChild($Mensaje);
        $PathAdvancing = $doc->createElement("PathAdvancing", dirname($archivo) . "/Advancing_$KeyProcess.ini");
        $root->appendChild($PathAdvancing);
        $PathCancel = $doc->createElement("PathStatus", dirname($archivo) . "/Status_$KeyProcess.ini");
        $root->appendChild($PathCancel);
        $XmlKeyProcess = $doc->createElement("KeyProcess", $KeyProcess);
        $root->appendChild($XmlKeyProcess);
        header("Content-Type:text/xml");
        echo $doc->saveXML();
    }

    function ModifyDir($userData)
    {
        $db = new DataBase();
        
        $DataBaseName = $userData['dataBaseName'];
        $NombreRepositorio=  filter_input(INPUT_POST, "NombreRepositorio");    
        $NameDirectory=filter_input(INPUT_POST, "NameDirectory");    
        $IdDirectory=filter_input(INPUT_POST, "IdDirectory");  
        $NombreUsuario = $userData['userName'];
        $IdUsuario = $userData['idUser'];
   
        $update = "UPDATE dir_$NombreRepositorio SET title='$NameDirectory' WHERE IdDirectory = $IdDirectory";
        
        if(($resultUpdate = $db->ConsultaQuery($DataBaseName, $update)) != 1)
            return XML::XMLReponse ("Error", 0, "$resultUpdate");
        
        XML::XMLReponse("ModifyDir", 1, "Modificado con éxito");
        Log::WriteEvent("19", $IdUsuario, $NombreUsuario, $NameDirectory);
    }

}

$tree=new Tree();

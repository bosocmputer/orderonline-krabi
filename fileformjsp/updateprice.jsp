<%@page import="org.json.JSONArray"%>
<%@page import="utils.PermissionUtil"%>
<%@include file="../globalsub.jsp"  %>
<%@page import="java.util.List"%>
<%@page import="java.util.Arrays"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%  /**/
    String pageName = "ยอดคงเหลือสินค้าตาม lot ปรับราคา";
    String pageCode = "P000000025";

    String xProviderCode24 = request.getSession().getAttribute("provider").toString();
    String xUser24 = request.getSession().getAttribute("user").toString();
    PermissionUtil pmu = new PermissionUtil(xProviderCode24);
    JSONArray pmList = pmu.getPermissUser(xUser24);
    if (!pmu.getKey(pmList, "P000000025").getBoolean("is_read")) {
        String site = new String("../index.jsp");
        response.setStatus(response.SC_MOVED_TEMPORARILY);
        response.sendRedirect(site);
        return;
    }
    request.setAttribute("title", pageName);
    request.setAttribute("sublink", "../");
    request.setAttribute("css", Arrays.asList("../css/select2/select2.min.css", "../css/datatables.min.css"));
    request.setAttribute("js", Arrays.asList(
            "../js/moment/moment.js",
            "../js/moment/moment-with-locales.js",
            "../js/select2/select2.full.min.js",
            "../js/select2/i18n/th.js",
            "../js/datatables.min.js",
            "../js/balance/balance_lot_updateprice.js"
    ));
%>
<jsp:include  page="../theme/header.jsp" flush="true" />
<style>
    body {
        color: black;
    }
    .vertical-center {
        vertical-align: middle !important;
    }
</style>
<input type="hidden" id="hSubLink" value="${sublink}">
<div>
    <div class="page-title">
        <div class="title_left">
            <h3><%=pageName%></h3>
        </div>
    </div>
    <div class="clearfix"></div>
    <!--Content Search Box-->
    <div class="row" id="contentSearchBox">
        <div class="col-md-12 col-sm-12 col-xs-12">
            <div class="x_panel">
                <h2 class="x_title">เงื่อนไขการค้นหา</h2>
                <div class="x_content">
                    <div class="row">
                        <div class="col-md-6 col-sm-4 col-xs-12">
                            <div class="form-group">
                                <label class="control-label">รหัสสินค้า</label>
                                <div class="input-group">
                                    <input type="text" id="txtSearchItem" class="form-control">
                                    <div class="input-group-btn">
                                        <button type="button" id="btnSearchItem" class="btn btn-primary"><i class="fa fa-play"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 col-sm-4 col-xs-12">
                            <div class="form-group">
                                <label class="control-label">ปรับราคา</label>
                                <div class="input-group">
                                    <input type="text" id="txtUpdatePrice" class="form-control">
                                    <div class="input-group-btn">
                                        <button type="button" id="btnUpdatePrice" class="btn btn-primary"><i class="fa fa-play"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="row"> 
                        <div class="col-md-3 col-sm-4 col-xs-12">
                            <div class="form-group">
                                <label class="control-label">คลังสินค้า</label>
                                <div class="input-group">
                                    <input type="text" id="txtSearchWarehouse" class="form-control">
                                    <div class="input-group-btn">
                                        <button type="button" id="btnSearchWarehouse" class="btn btn-primary"><i class="fa fa-search"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 col-sm-4 col-xs-12">
                            <div class="form-group">
                                <label class="control-label">จากรหัสพื้นที่เก็บ</label>
                                <div class="input-group">
                                    <input type="text" id="txtSearchShelf" class="form-control">
                                    <div class="input-group-btn">
                                        <button type="button" id="btnSearchShelf" class="btn btn-primary"><i class="fa fa-search"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 col-sm-4 col-xs-12">
                            <div class="form-group">
                                <label class="control-label">ถึงรหัสพื้นที่เก็บ</label>
                                <div class="input-group">
                                    <input type="text" id="txtSearchShelf2" class="form-control">
                                    <div class="input-group-btn">
                                        <button type="button" id="btnSearchShelf2" class="btn btn-primary"><i class="fa fa-search"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-3 col-sm-4 col-xs-12">
                            <div class="form-group">
                                <label class="control-label">กลุ่มสินค้าย่อย</label>
                                <div class="input-group">
                                    <input type="text" id="txtSearchGroupSub" class="form-control">
                                    <div class="input-group-btn">
                                        <button type="button" id="btnSearchGroupSub" class="btn btn-primary"><i class="fa fa-search"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 col-sm-4 col-xs-12">
                            <div class="form-group">
                                <label class="control-label">กลุ่มสินค้าย่อย2</label>
                                <div class="input-group">
                                    <input type="text" id="txtSearchGroupSub2" class="form-control">
                                    <div class="input-group-btn">
                                        <button type="button" id="btnSearchGroupSub2" class="btn btn-primary"><i class="fa fa-search"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 col-sm-4 col-xs-12">
                            <div class="form-group">
                                <label class="control-label">ยี่ห้อสินค้า</label>
                                <div class="input-group">
                                    <input type="text" id="txtSearchBrand" class="form-control">
                                    <div class="input-group-btn">
                                        <button type="button" id="btnSearchBrand" class="btn btn-primary"><i class="fa fa-search"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-3 col-sm-4 col-xs-12">
                            <div class="form-group">
                                <label class="control-label">รุ่นสินค้า</label>
                                <div class="input-group">
                                    <input type="text" id="txtSearchModel" class="form-control">
                                    <div class="input-group-btn">
                                        <button type="button" id="btnSearchModel" class="btn btn-primary"><i class="fa fa-search"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 col-sm-4 col-xs-12">
                            <div class="form-group">
                                <label class="control-label">หมวดสินค้า</label>
                                <div class="input-group">
                                    <input type="text" id="txtSearchCategory" class="form-control">
                                    <div class="input-group-btn">
                                        <button type="button" id="btnSearchCategory" class="btn btn-primary"><i class="fa fa-search"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3 col-sm-4 col-xs-12">
                            <div class="form-group">
                                <label class="control-label">รูปแบบสินค้า</label>
                                <div class="input-group">
                                    <input type="text" id="txtSearchFormat" class="form-control">
                                    <div class="input-group-btn">
                                        <button type="button" id="btnSearchFormat" class="btn btn-primary"><i class="fa fa-search"></i></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-12 col-sm-12 col-xs-12" style="padding-top: 25px;">
                            <div class="form-group">
                                <button type="button" id="btnLoadBalanceLot" class="btn btn-success"><span class="fa fa-play"></span> ประมวลผล</button>
                                <button type="button" id="btnExportBalanceLot" onclick="fnExcelReport()" class="btn btn-primary">  ส่งออก Excel </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <!--Content Table Box-->
    <div class="row" id="contentTableBox" style="display: none;">
        <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
            <div class="x_panel" style="padding: 0;">
                <div class="x_title">
                    <div class="row">
                        <div class="col-md-2 col-sm-6 col-xs-6 pull-right">
                            <div class="form-group">
                                <div class="input-group input-group-sm">
                                    <select id="selTableRows" class="form-control">
                                        <option value="20">20</option>
                                        <option value="50">50</option>
                                        <option value="70">70</option>
                                        <option value="100">100</option>
                                        <option value="99999999">All</option>
                                    </select>
                                    <span class="input-group-addon" style="color: #000;">แถว</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table table-condensed table-striped" style="margin-bottom: 0;">
                        <thead>
                            <tr>
                                <th style="width: 40%"> <a href="javascript:void(0)" onclick="sortIc()"> รหัสสินค้า ~ ชื่อสินค้า </a> <i id="shortIc" class="fa fa-sort-down"> </i></th>
                                <th style="width: 15%"> <a href="javascript:void(0)" onclick="sortPrice()"> ราคา </a> <i id="shortPrice" class="fa fa-sort-down"> </i></th>
                                <th style="width: 10%">  <a href="javascript:void(0)" onclick="sortQty()"> จำนวน </a> <i id="shortQty" class="fa fa-sort-down"> </i> </th>
                                <th style="width: 10%">  <a href="javascript:void(0)" onclick="sortYear()"> จากปีเดือน </a> <i id="shortYear" class="fa fa-sort-down"> </i></th>
                                <th style="width: 10%"> <a href="javascript:void(0)" onclick="sortDay()"> วันที่ปรับราคา </a> <i id="shortDay" class="fa fa-sort-down"> </i>   </th>
                                <!--<th>จำนวน (ทั้งหมด)</th>-->
                                <th style="width: 5%"></th>
                            </tr>
                        </thead>
                        <tbody id="list"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!--Content Modal Search Box-->
    <!-- Modal -->
    <div class="modal fade" id="contentModalSearchBox" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" data-backdrop="static">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button> 
                    <h4 class="modal-title" id="myModalLabel">หน้าจอเลือกข้อมูล</h4>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
                            <div class="table-responsive">
                                <table id="tableSearch" class="table table-condensed table-striped"></table>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">ปิด</button>
                    <button type="button" id="btnSubmit" class="btn btn-primary">ตกลง</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Warehouse -->
    <div class="modal fade" id="contentModalSearchWarehouseBox" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" data-backdrop="static">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button> 
                    <h4 class="modal-title" id="myModalLabel">หน้าจอเลือกข้อมูล</h4>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
                            <div class="table-responsive">
                                <table id="tableSearchWarehouse" style="width:100%;" class="table table-condensed table-striped"></table>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">ปิด</button>
                    <button type="button" id="btnSubmitWarehouse" class="btn btn-primary">ตกลง</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Shelf -->
    <div class="modal fade" id="contentModalSearchShelfBox" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" data-backdrop="static">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button> 
                    <h4 class="modal-title" id="myModalLabel">หน้าจอเลือกข้อมูล</h4>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
                            <div class="table-responsive">
                                <table id="tableSearchShelf" style="width:100%;" class="table table-condensed table-striped"></table>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">ปิด</button>
                    <button type="button" id="btnSubmitShelf" class="btn btn-primary">ตกลง</button>
                </div>
            </div>
        </div>
    </div>

    <!-- GroupSub -->
    <div class="modal fade" id="contentModalSearchGroupSubBox" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" data-backdrop="static">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button> 
                    <h4 class="modal-title" id="myModalLabel">หน้าจอเลือกข้อมูล</h4>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
                            <div class="table-responsive">
                                <table id="tableSearchGroupSub" style="width:100%;" class="table table-condensed table-striped"></table>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">ปิด</button>
                    <button type="button" id="btnSubmitGroupSub" class="btn btn-primary">ตกลง</button>
                </div>
            </div>
        </div>
    </div>

    <!-- GroupSub2 -->
    <div class="modal fade" id="contentModalSearchGroupSub2Box" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" data-backdrop="static">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button> 
                    <h4 class="modal-title" id="myModalLabel">หน้าจอเลือกข้อมูล</h4>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
                            <div class="table-responsive">
                                <table id="tableSearchGroupSub2" style="width:100%;" class="table table-condensed table-striped"></table>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">ปิด</button>
                    <button type="button" id="btnSubmitGroupSub2" class="btn btn-primary">ตกลง</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Brand -->
    <div class="modal fade" id="contentModalSearchBrandBox" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" data-backdrop="static">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button> 
                    <h4 class="modal-title" id="myModalLabel">หน้าจอเลือกข้อมูล</h4>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
                            <div class="table-responsive">
                                <table id="tableSearchBrand" style="width:100%;" class="table table-condensed table-striped"></table>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">ปิด</button>
                    <button type="button" id="btnSubmitBrand" class="btn btn-primary">ตกลง</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Model -->
    <div class="modal fade" id="contentModalSearchModelBox" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" data-backdrop="static">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button> 
                    <h4 class="modal-title" id="myModalLabel">หน้าจอเลือกข้อมูล</h4>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
                            <div class="table-responsive">
                                <table id="tableSearchModel" style="width:100%;" class="table table-condensed table-striped"></table>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">ปิด</button>
                    <button type="button" id="btnSubmitModel" class="btn btn-primary">ตกลง</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Category -->
    <div class="modal fade" id="contentModalSearchCategoryBox" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" data-backdrop="static">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button> 
                    <h4 class="modal-title" id="myModalLabel">หน้าจอเลือกข้อมูล</h4>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
                            <div class="table-responsive">
                                <table id="tableSearchCategory" style="width:100%;" class="table table-condensed table-striped"></table>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">ปิด</button>
                    <button type="button" id="btnSubmitCategory" class="btn btn-primary">ตกลง</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Format -->
    <div class="modal fade" id="contentModalSearchFormatBox" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" data-backdrop="static">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button> 
                    <h4 class="modal-title" id="myModalLabel">หน้าจอเลือกข้อมูล</h4>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
                            <div class="table-responsive">
                                <table id="tableSearchFormat" style="width:100%;" class="table table-condensed table-striped"></table>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-default" data-dismiss="modal">ปิด</button>
                    <button type="button" id="btnSubmitFormat" class="btn btn-primary">ตกลง</button>
                </div>
            </div>
        </div>
    </div>

    <!--Content Pagination-->
    <div class="row" id="contentPaginationBox" style="display: none;">
        <div class="col-md-12 col-sm-12 col-xs-12 text-center" id="contentPaginationList">
            <div class="form-inline">
                <div class="input-group">
                    <div class="input-group-btn">
                        <button id="btn-pagi-first" class="btn btn-default btn-flat" type="button"><i class="fa fa-angle-double-left"></i></button>
                        <button id="btn-pagi-previous" class="btn btn-default btn-flat" type="button"><i class="fa fa-angle-left"></i></button>
                    </div>
                    <input type="text" id='txt-pagination' class="form-control text-center"placeholder="กรุณาใส่หมายเลขหน้า">
                    <div class="input-group-btn">
                        <button id="btn-pagi-next" class="btn btn-default btn-flat" type="button" style="margin-right: 0px;"><i class="fa fa-angle-right"></i></button>
                        <button id="btn-pagi-last" class="btn btn-default btn-flat" type="button"><i class="fa fa-angle-double-right"></i></button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
<jsp:include  page="../theme/footer.jsp" flush="true" />
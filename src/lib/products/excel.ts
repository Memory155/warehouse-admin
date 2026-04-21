import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

export const PRODUCT_IMPORT_HEADERS = [
  "商品名称",
  "分类名称",
  "单位",
  "当前库存",
  "安全库存",
  "存放位置",
  "备注",
  "状态",
] as const;

const MAX_NAME_LENGTH = 100;
const MAX_UNIT_LENGTH = 20;
const MAX_LOCATION_LENGTH = 100;
const MAX_REMARK_LENGTH = 300;
const HEADER_FILL_COLOR = "FFDCEBFF";
const HEADER_FONT_COLOR = "FF17324D";
const HEADER_BORDER_COLOR = "FFB8CCE4";

export type ProductExcelCategory = {
  id: string;
  name: string;
  isActive: boolean;
};

export type ProductExcelItem = {
  id: string;
  name: string;
  categoryId: string;
  unit: string;
  spec: string | null;
  currentStock: number;
  safetyStock: number;
  location: string | null;
  remark: string | null;
  isActive: boolean;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
  };
};

export type ProductImportCommitRow = {
  rowNumber: number;
  action: "create" | "update";
  name: string;
  categoryId: string;
  categoryName: string;
  unit: string;
  spec: string;
  currentStock: number;
  safetyStock: number;
  location: string;
  remark: string;
  isActive: boolean;
};

export type ProductImportError = {
  rowNumber: number;
  field: string;
  message: string;
};

export type ProductImportPreview = {
  rows: ProductImportCommitRow[];
  errors: ProductImportError[];
  summary: {
    totalRows: number;
    dataRows: number;
    validRows: number;
    errorRows: number;
    createCount: number;
    updateCount: number;
  };
};

type ExistingProduct = {
  id: string;
  name: string;
  categoryId: string;
};

function normalizeText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeKey(name: string, categoryName: string) {
  return `${name.trim().toLocaleLowerCase("zh-CN")}::${categoryName.trim().toLocaleLowerCase("zh-CN")}`;
}

function parseNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  const text = normalizeText(value);
  if (!text) {
    return Number.NaN;
  }

  const normalized = text.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseStatus(value: unknown) {
  const text = normalizeText(value);
  if (!text) return true;

  if (["启用", "是", "true", "TRUE", "1", "active", "ACTIVE"].includes(text)) {
    return true;
  }

  if (["停用", "否", "false", "FALSE", "0", "disabled", "DISABLED"].includes(text)) {
    return false;
  }

  return null;
}

function isEmptyRow(values: unknown[]) {
  return values.every((value) => normalizeText(value) === "");
}

function makeWorksheet(data: unknown[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = [
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 26 },
    { wch: 12 },
  ];
  return sheet;
}

function styleExcelJsHeaderRow(row: ExcelJS.Row) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.alignment = {
      horizontal: "left",
      vertical: "middle",
    };
    cell.font = {
      bold: true,
      color: { argb: HEADER_FONT_COLOR },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL_COLOR },
    };
    cell.border = {
      top: { style: "thin", color: { argb: HEADER_BORDER_COLOR } },
      bottom: { style: "thin", color: { argb: HEADER_BORDER_COLOR } },
      left: { style: "thin", color: { argb: HEADER_BORDER_COLOR } },
      right: { style: "thin", color: { argb: HEADER_BORDER_COLOR } },
    };
    cell.protection = {
      locked: true,
    };
  });
}

function styleExcelJsDataRows(worksheet: ExcelJS.Worksheet, startRow: number) {
  for (let rowNumber = startRow; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    row.height = 22;
    row.eachCell((cell) => {
      cell.alignment = {
        horizontal: "left",
        vertical: "middle",
      };
      cell.protection = {
        locked: false,
      };
    });
  }
}

export async function buildProductExportWorkbook(products: ProductExcelItem[]) {
  const workbook = new ExcelJS.Workbook();
  const productSheet = workbook.addWorksheet("商品数据");
  productSheet.properties.defaultRowHeight = 22;

  productSheet.columns = [
    { header: "商品名称", key: "name", width: 18 },
    { header: "分类名称", key: "categoryName", width: 18 },
    { header: "单位", key: "unit", width: 12 },
    { header: "当前库存", key: "currentStock", width: 12 },
    { header: "安全库存", key: "safetyStock", width: 12 },
    { header: "存放位置", key: "location", width: 16 },
    { header: "备注", key: "remark", width: 26 },
    { header: "状态", key: "status", width: 12 },
    { header: "更新时间", key: "updatedAt", width: 22 },
  ];

  products.forEach((item) => {
    productSheet.addRow({
      name: item.name,
      categoryName: item.category.name,
      unit: item.unit,
      currentStock: item.currentStock,
      safetyStock: item.safetyStock,
      location: item.location ?? "",
      remark: item.remark ?? "",
      status: item.isActive ? "启用" : "停用",
      updatedAt: item.updatedAt.toLocaleString("zh-CN"),
    });
  });

  styleExcelJsHeaderRow(productSheet.getRow(1));
  styleExcelJsDataRows(productSheet, 2);
  productSheet.views = [{ state: "frozen", ySplit: 1 }];
  await productSheet.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: false,
    pivotTables: false,
  });

  const categorySheet = workbook.addWorksheet("分类字典");
  categorySheet.properties.defaultRowHeight = 22;
  categorySheet.columns = [
    { header: "分类名称", key: "name", width: 18 },
    { header: "状态", key: "status", width: 18 },
  ];

  products
    .map((item) => item.category.name)
    .filter((name, index, list) => list.indexOf(name) === index)
    .sort((a, b) => a.localeCompare(b, "zh-CN"))
    .forEach((name) => {
      categorySheet.addRow({
        name,
        status: "导出时有关联商品",
      });
    });

  styleExcelJsHeaderRow(categorySheet.getRow(1));
  styleExcelJsDataRows(categorySheet, 2);
  categorySheet.views = [{ state: "frozen", ySplit: 1 }];
  await categorySheet.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: false,
    pivotTables: false,
  });

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

export function buildProductImportTemplateWorkbook(categories: ProductExcelCategory[]) {
  const workbook = XLSX.utils.book_new();

  const templateRows: unknown[][] = [
    PRODUCT_IMPORT_HEADERS.slice() as unknown as unknown[],
    ["示例商品", categories[0]?.name ?? "请填写已有分类", "件", 10, 3, "一楼仓库", "", "启用"],
  ];

  XLSX.utils.book_append_sheet(workbook, makeWorksheet(templateRows), "导入模板");

  const categoryRows: unknown[][] = [
    ["分类名称", "状态"],
    ...categories.map((item) => [item.name, item.isActive ? "启用" : "停用"]),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(categoryRows),
    "分类字典",
  );

  const guideRows: unknown[][] = [
    ["填写说明"],
    ["1. 仅支持导入 .xlsx 文件。"],
    ["2. 商品名称、分类名称、单位、当前库存、安全库存为必填。"],
    ["3. 分类名称必须是系统里已有且启用中的分类。"],
    ["4. 状态可填“启用”或“停用”，留空默认启用。"],
    ["5. 以“商品名称 + 分类名称”判断是新增还是更新。"],
    ["6. 图片不会通过 Excel 导入，请在商品详情中单独上传。"],
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(guideRows),
    "填写说明",
  );

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function parseProductImportWorkbook(
  fileBuffer: Buffer,
  categories: ProductExcelCategory[],
  existingProducts: ExistingProduct[],
): ProductImportPreview {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return {
      rows: [],
      errors: [{ rowNumber: 1, field: "文件", message: "Excel 文件为空" }],
      summary: {
        totalRows: 0,
        dataRows: 0,
        validRows: 0,
        errorRows: 0,
        createCount: 0,
        updateCount: 0,
      },
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });

  const rows = matrix.slice(1);
  const indexedDataRows = rows
    .map((row, index) => ({
      row,
      rowNumber: index + 2,
    }))
    .filter((item) => !isEmptyRow(item.row));
  const errors: ProductImportError[] = [];
  const validRows: ProductImportCommitRow[] = [];

  const activeCategoryMap = new Map(
    categories
      .filter((item) => item.isActive)
      .map((item) => [item.name.trim().toLocaleLowerCase("zh-CN"), item]),
  );

  const existingKeyMap = new Map(
    existingProducts.map((item) => [
      normalizeKey(item.name, categories.find((category) => category.id === item.categoryId)?.name ?? ""),
      item,
    ]),
  );

  const duplicateKeys = new Set<string>();

  indexedDataRows.forEach(({ row, rowNumber }) => {
    const [
      rawName,
      rawCategoryName,
      rawUnit,
      rawCurrentStock,
      rawSafetyStock,
      rawLocation,
      rawRemark,
      rawStatus,
    ] = row;

    const rowErrors: ProductImportError[] = [];
    const name = normalizeText(rawName);
    const categoryName = normalizeText(rawCategoryName);
    const unit = normalizeText(rawUnit);
    const location = normalizeText(rawLocation);
    const remark = normalizeText(rawRemark);
    const currentStock = parseNumber(rawCurrentStock);
    const safetyStock = parseNumber(rawSafetyStock);
    const status = parseStatus(rawStatus);

    if (!name) {
      rowErrors.push({ rowNumber, field: "商品名称", message: "商品名称不能为空" });
    } else if (name.length > MAX_NAME_LENGTH) {
      rowErrors.push({
        rowNumber,
        field: "商品名称",
        message: `商品名称最多 ${MAX_NAME_LENGTH} 字`,
      });
    }

    if (!categoryName) {
      rowErrors.push({ rowNumber, field: "分类名称", message: "分类名称不能为空" });
    }

    if (!unit) {
      rowErrors.push({ rowNumber, field: "单位", message: "单位不能为空" });
    } else if (unit.length > MAX_UNIT_LENGTH) {
      rowErrors.push({ rowNumber, field: "单位", message: `单位最多 ${MAX_UNIT_LENGTH} 字` });
    }

    if (location.length > MAX_LOCATION_LENGTH) {
      rowErrors.push({
        rowNumber,
        field: "存放位置",
        message: `存放位置最多 ${MAX_LOCATION_LENGTH} 字`,
      });
    }

    if (remark.length > MAX_REMARK_LENGTH) {
      rowErrors.push({ rowNumber, field: "备注", message: `备注最多 ${MAX_REMARK_LENGTH} 字` });
    }

    if (Number.isNaN(currentStock) || currentStock < 0) {
      rowErrors.push({
        rowNumber,
        field: "当前库存",
        message: "当前库存必须是大于等于 0 的数字",
      });
    }

    if (Number.isNaN(safetyStock) || safetyStock < 0) {
      rowErrors.push({
        rowNumber,
        field: "安全库存",
        message: "安全库存必须是大于等于 0 的数字",
      });
    }

    if (status === null) {
      rowErrors.push({
        rowNumber,
        field: "状态",
        message: "状态只能填写“启用”或“停用”",
      });
    }

    const category = activeCategoryMap.get(categoryName.toLocaleLowerCase("zh-CN"));
    if (categoryName && !category) {
      rowErrors.push({
        rowNumber,
        field: "分类名称",
        message: "分类不存在或已停用",
      });
    }

    const duplicateKey = normalizeKey(name, categoryName);
    if (name && categoryName) {
      if (duplicateKeys.has(duplicateKey)) {
        rowErrors.push({
          rowNumber,
          field: "商品名称",
          message: "同一个文件中存在重复的“商品名称 + 分类名称”组合",
        });
      }
      duplicateKeys.add(duplicateKey);
    }

    if (rowErrors.length > 0 || !category) {
      errors.push(...rowErrors);
      return;
    }

    const existing = existingKeyMap.get(duplicateKey);
    validRows.push({
      rowNumber,
      action: existing ? "update" : "create",
      name,
      categoryId: category.id,
      categoryName: category.name,
      unit,
      spec: "",
      currentStock,
      safetyStock,
      location,
      remark,
      isActive: status ?? true,
    });
  });

  return {
    rows: validRows,
    errors,
    summary: {
      totalRows: rows.length,
      dataRows: indexedDataRows.length,
      validRows: validRows.length,
      errorRows: new Set(errors.map((item) => item.rowNumber)).size,
      createCount: validRows.filter((item) => item.action === "create").length,
      updateCount: validRows.filter((item) => item.action === "update").length,
    },
  };
}

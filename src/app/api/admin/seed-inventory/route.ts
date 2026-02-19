
import { NextResponse } from 'next/server';
import { mysqlPool } from '@/lib/mysql';
import { randomUUID } from 'crypto';
import { normalizeInventoryCategory } from '@/lib/inventory/catalog';
import { ensureInventorySchema } from '@/lib/schema/inventory';


export const dynamic = 'force-dynamic';

const INVENTORY_ITEMS = [
  // Chemicals & Reagents (Chemical names usually imply specific substances, so keep full name unless it's a concentration spec)
  { name: '1-Pyrenecarboxylic Acid (1-芘甲酸)', category: 'Chemicals', unit: 'g' },
  { name: 'N,N-Dimethylacetamide (N,N-二甲基乙酰胺)', category: 'Chemicals', unit: 'ml' },
  { name: 'Deuterated DMSO (氘代DMSO)', category: 'Chemicals', unit: 'ml' },
  { name: 'Silane (硅烷)', category: 'Chemicals', unit: 'ml' },
  { name: 'Oxalic Acid (草酸)', category: 'Chemicals', unit: 'g' },
  { name: 'Titanium Tetraisopropoxide (钛酸异丙酯 / TPT)', category: 'Chemicals', unit: 'ml' },
  { name: 'Thulium Chloride (氯化铥)', category: 'Chemicals', unit: 'g' },
  { name: 'PVP (聚乙烯吡咯烷酮)', category: 'Chemicals', unit: 'g' },
  { name: 'PVDF-HFP (偏氟乙烯-六氟丙烯共聚物)', category: 'Chemicals', unit: 'g' },
  { name: 'TTMAP', category: 'Chemicals', unit: 'g' },
  { name: 'UV Absorber (紫外吸收剂)', category: 'Chemicals', unit: 'ml' },
  { name: 'T+ Low Molecular Weight F (T+低分子量F)', category: 'Chemicals', unit: 'ml' },
  { name: 'Calcium Aluminate (铝酸钙)', category: 'Chemicals', unit: 'g' },
  { name: 'General Chemical Reagents (通用化学试剂)', category: 'Chemicals', unit: 'bottle' },

  // Raw Materials
  { name: 'Electroluminescent Wire (电致发光丝)', category: 'Raw Materials', unit: 'm', sku: 'MAT-ELWIRE' },

  // Lab Consumables (Genericizing names)
  { name: 'Syringe (针筒)', category: 'Consumables', unit: 'box' }, // Removed "5ml"
  { name: 'Molecular Sieve (分子筛)', category: 'Consumables', unit: 'kg' },
  { name: 'Quartz Sheet (石英片)', category: 'Consumables', unit: 'pcs' },
  { name: 'Tin Foil (锡纸)', category: 'Consumables', unit: 'roll' }, // Merged 20cm and General
  { name: 'PLA Filament (PLA耗材)', category: 'Consumables', unit: 'roll' }, // Removed "25KG"
  { name: 'TPU Filament (TPU耗材)', category: 'Consumables', unit: 'roll' },
  { name: 'Waterproof Paint (防水涂料)', category: 'Consumables', unit: 'kg' },
  { name: 'Paint (油漆)', category: 'Consumables', unit: 'kg' },
  { name: '3M Glue (3M胶)', category: 'Consumables', unit: 'bottle' },
  { name: 'Desiccant (吸湿卡/再生)', category: 'Consumables', unit: 'pack' },
  { name: 'Fluorinated Bottle (氟化瓶)', category: 'Consumables', unit: 'pcs' },
  { name: 'Ziplock Bags (自封袋)', category: 'Consumables', unit: 'pack' },
  { name: 'Sealed Bags (密封袋)', category: 'Consumables', unit: 'pack' },
  { name: 'Large Card Paper (大卡纸)', category: 'Consumables', unit: 'sheet' },
  { name: 'Origami Paper (折纸)', category: 'Consumables', unit: 'pack' },
  
  // Glassware (Genericizing names)
  { name: 'Beaker (烧杯)', category: 'Glassware', unit: 'pcs' },
  { name: 'Erlenmeyer Flask (锥形瓶)', category: 'Glassware', unit: 'pcs' },
  { name: 'Graduated Cylinder (量筒)', category: 'Glassware', unit: 'pcs' },
  { name: 'Test Tube (试管)', category: 'Glassware', unit: 'pcs' },
  { name: 'Petri Dish (培养皿)', category: 'Glassware', unit: 'pcs' },
  { name: 'Glass Stirring Rod (玻璃搅拌棒)', category: 'Glassware', unit: 'pcs' },
  { name: 'Dropper (胶头滴管)', category: 'Glassware', unit: 'pcs' },
  { name: 'Funnel (漏斗)', category: 'Glassware', unit: 'pcs' },
  { name: 'Wash Bottle (洗瓶)', category: 'Glassware', unit: 'pcs' },

  // Equipment & Devices
  { name: 'Oven (烘箱)', category: 'Equipment', unit: 'unit' },
  { name: 'UV Lamp (紫外灯)', category: 'Equipment', unit: 'unit' },
  { name: 'Heater (小太阳)', category: 'Equipment', unit: 'unit' },
  { name: 'Humidifier Spray (加湿喷雾)', category: 'Equipment', unit: 'unit' },
  { name: 'LED Light Board (LED灯板)', category: 'Equipment', unit: 'pcs' },
  { name: '3D Printer (3D打印机)', category: 'Equipment', unit: 'unit' },
  { name: 'White Light Flashlight (白光手电筒)', category: 'Equipment', unit: 'unit' },
  { name: 'Converter (转换器)', category: 'Equipment', unit: 'pcs' },
  { name: 'Shelf (货架)', category: 'Equipment', unit: 'unit' },
  { name: 'Iron Tray (铁盘)', category: 'Equipment', unit: 'pcs' },
  { name: 'Hot Plate (加热板)', category: 'Equipment', unit: 'unit' },
  { name: 'Phone Tripod (手机三脚架)', category: 'Equipment', unit: 'unit' },

  // Tools
  { name: 'Diagonal Pliers (水口钳)', category: 'Tools', unit: 'pcs' },
  { name: 'Tweezers (镊子)', category: 'Tools', unit: 'pcs' },
  { name: 'Claw Hammer (羊角锤)', category: 'Tools', unit: 'pcs' },
  { name: 'Crowbar (撬棍)', category: 'Tools', unit: 'pcs' },
  { name: 'Grinding Rod (研磨棒)', category: 'Tools', unit: 'pcs' },
  { name: 'Cable Ties (扎带)', category: 'Tools', unit: 'pack' },
  { name: 'Braided Rope (编绳)', category: 'Tools', unit: 'roll' },

  // Office & Lab Safety (Genericizing names)
  { name: 'Copy Paper (打印纸)', category: 'Office', unit: 'pack' }, // Removed "A4"
  { name: 'Gel Pen (中性笔)', category: 'Office', unit: 'box' }, // Removed "Black" -> "Gel Pen" implies variant can be Black/Red/Blue
  { name: 'Stapler (订书机)', category: 'Office', unit: 'pcs' },
  { name: 'Staples (订书钉)', category: 'Office', unit: 'box' },
  { name: 'Paper Clips (回形针)', category: 'Office', unit: 'box' },
  { name: 'Sticky Notes (便利贴)', category: 'Office', unit: 'pack' },
  { name: 'File Folder (透明文件夹)', category: 'Office', unit: 'pack' },
  { name: 'Whiteboard Marker (白板笔)', category: 'Office', unit: 'set' },
  { name: 'Correction Tape (修正带)', category: 'Office', unit: 'pcs' },
  { name: 'Scissors (剪刀)', category: 'Office', unit: 'pcs' },
  
  { name: 'Safety Goggles (护目镜)', category: 'Safety', unit: 'pair' },
  { name: 'Nitrile Gloves (丁腈手套)', category: 'Safety', unit: 'box' },
  { name: 'Lab Coat (白大褂)', category: 'Safety', unit: 'pcs' },
  { name: 'Protective Clothing (防护服)', category: 'Safety', unit: 'set' },

  // Testing & Special
  { name: 'Car Lights (车灯)', category: 'Testing', unit: 'pcs' }, // Removed "Second-hand" as that's a condition/spec
  { name: 'PVDF Sample (PVDF试样)', category: 'Testing', unit: 'pcs' },
  { name: 'Clay Board (黏土板)', category: 'Testing', unit: 'pcs' },
  { name: 'Plant Seeds (植物种子)', category: 'Testing', unit: 'pack' }, // Genericized "Radish"
  { name: 'Flashlight (手电筒)', category: 'Testing', unit: 'pcs' }, // Genericized "Sample Flashlight"
  { name: 'Shore Hardness Tester (邵氏硬度计)', category: 'Testing', unit: 'unit' },
  { name: 'pH Test Strips (pH试纸)', category: 'Testing', unit: 'pack' },

  // Pantry
  { name: 'Pork (猪肉)', category: 'Pantry', unit: 'catty' },
  { name: 'Vegetables (蔬菜)', category: 'Pantry', unit: 'catty' }, // Consolidated specific veggies
  { name: 'Dumpling Wrappers (饺子皮)', category: 'Pantry', unit: 'pack' },
  { name: 'Eggs (鸡蛋)', category: 'Pantry', unit: 'box' },
  { name: 'Seasonings & Vinegar (调料、醋)', category: 'Pantry', unit: 'bottle' },
  { name: 'Beef (牛肉)', category: 'Pantry', unit: 'catty' },
  { name: 'Braised Food (卤货)', category: 'Pantry', unit: 'box' },
  { name: 'Snacks (零食)', category: 'Pantry', unit: 'pack' },
  { name: 'Fruit (水果)', category: 'Pantry', unit: 'box' },
  { name: 'Coffee (咖啡)', category: 'Pantry', unit: 'box' },
  { name: 'Tea/Beverage (茶饮)', category: 'Pantry', unit: 'cup' }, // Genericized "Heytea"
  { name: 'Disposable Kitchenware (一次性用品+厨具)', category: 'Pantry', unit: 'set' },

  // Services
  { name: 'Shipping Fee (运费)', category: 'Service', unit: 'time' },
  { name: 'Taxi Fare (打车费)', category: 'Service', unit: 'time' },
  { name: 'Key Making (配钥匙)', category: 'Service', unit: 'time' },
  { name: 'Insurance (保险)', category: 'Service', unit: 'year' },
  { name: 'Imaging Service (成像服务)', category: 'Service', unit: 'time' }, // Genericized X-ray
];

export async function GET() {
  try {
    const pool = mysqlPool();
    const results = [];
    
    // Ensure table exists using the centralized schema definition
    await ensureInventorySchema();

    // Force clear table as requested
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    await pool.query('TRUNCATE TABLE inventory_items');
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');

    for (const item of INVENTORY_ITEMS) {
      // Determine SKU first
      const itemSku = (item as { sku?: string }).sku || '';
      
      // Clean name: extract Chinese if mixed, or just use as is
      let cleanName = item.name;
      const chineseMatch = item.name.match(/[\u4e00-\u9fa5]+/);
      if (chineseMatch) {
         // If there are parentheses, try to extract Chinese from inside or outside
         const parensMatch = item.name.match(/\(([^)]*[\u4e00-\u9fa5]+[^)]*)\)/);
         if (parensMatch) {
           cleanName = parensMatch[1];
         } else {
           // If just mixed text, take the Chinese part
           cleanName = item.name.replace(/[a-zA-Z\s\d\-\,\.]+/g, '').trim() || item.name;
         }
      }

      // Generate a simple SKU if not provided
      const sku = itemSku || `GEN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      await pool.query(
        `INSERT INTO inventory_items (
          id, sku, name, unit, category, 
          unit_price, safety_stock, 
          is_deleted, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, 10, 0, NOW(), NOW())`,
        [randomUUID(), sku, cleanName, item.unit, normalizeInventoryCategory(item.category)]
      );
      
      results.push({ name: cleanName, status: 'created' });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Seed failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to seed inventory' },
      { status: 500 }
    );
  }
}

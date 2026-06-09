export interface ActionEntry {
  category: string;
  action: string;
  aliases: string[];
}

export const ACTION_DICTIONARY: ActionEntry[] = [
  { category: "物料准备类", action: "准备", aliases: ["准备", "配制", "稀释", "解冻", "预热", "冷却", "称量", "溶解", "复溶"] },
  { category: "装载与取放类", action: "转移", aliases: ["转移", "移入", "倒入"] },
  { category: "装载与取放类", action: "放置", aliases: ["放置", "放入", "置于", "装载", "定位"] },
  { category: "容器操作类", action: "开盖", aliases: ["开盖", "打开"] },
  { category: "容器操作类", action: "闭盖", aliases: ["闭盖", "关盖", "关闭"] },
  { category: "液体处理类", action: "弃液", aliases: ["弃液", "弃去", "丢弃", "倒掉", "废弃"] },
  { category: "液体处理类", action: "吸液", aliases: ["吸液", "吸去", "吸除", "移除", "去除"] },
  { category: "液体处理类", action: "加液", aliases: ["加液", "加入", "添加", "滴加", "补液", "分装"] },
  { category: "液体处理类", action: "采样", aliases: ["采样", "取样", "吸取"] },
  { category: "混合处理类", action: "重悬", aliases: ["重悬", "吹打重悬"] },
  { category: "混合处理类", action: "混匀", aliases: ["混匀", "吹打", "振荡", "涡旋", "搅拌", "颠倒混合", "洗涤"] },
  { category: "反应/培养类", action: "孵育", aliases: ["孵育", "反应", "静置", "等待", "计时"] },
  { category: "反应/培养类", action: "培养", aliases: ["培养"] },
  { category: "分离纯化类", action: "离心", aliases: ["离心"] },
  { category: "分离纯化类", action: "过滤", aliases: ["过滤"] },
  { category: "分离纯化类", action: "洗涤", aliases: ["洗涤"] },
  { category: "环境控制类", action: "控温", aliases: ["控温", "加热", "冷却", "避光", "通气", "除气", "加湿", "干燥"] },
  { category: "检测观察类", action: "观察", aliases: ["观察", "拍照", "成像"] },
  { category: "检测观察类", action: "检测", aliases: ["检测", "测量", "读数", "扫描", "扫码"] },
  { category: "判断决策类", action: "判断", aliases: ["判断", "确认", "检查", "筛选", "判定", "选择", "终止"] },
  { category: "废弃回收类", action: "收集", aliases: ["收集", "回收", "封存", "转运"] },
  { category: "数据记录类", action: "记录", aliases: ["记录", "标记", "编号", "保存", "上传", "导出"] },
  { category: "设备维护类", action: "校准", aliases: ["校准", "初始化", "自检", "复位", "报警", "暂停", "重启", "维护"] }
];

const orderedEntries = ACTION_DICTIONARY.flatMap((entry) =>
  entry.aliases.map((alias) => ({ ...entry, alias }))
).sort((left, right) => right.alias.length - left.alias.length);

export function matchAction(text: string): ActionEntry | undefined {
  return orderedEntries.find((entry) => text.includes(entry.alias));
}

export function standardizeAction(text: string): string {
  return matchAction(text)?.action ?? "未识别";
}

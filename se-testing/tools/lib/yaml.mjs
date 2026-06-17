// YAML 是本项目的用户接入面，必须接受真实业务项目里常见的标准 YAML 写法。
// 使用成熟解析库比维护受控子集更可靠；schema 约束仍由 validate-intention 负责。
import yaml from "js-yaml";

export function parseYaml(text) {
  return yaml.load(text) ?? {};
}

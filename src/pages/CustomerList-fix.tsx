// 下拉菜单的修改部分
import { Select } from 'antd';
import { Customer } from '../types';

interface EditProps {
  record: Customer;
  options: { label: string; value: string; color?: string }[];
  dataIndex: string;
  saveEditedCell: (id: string) => void;
}

const StationManagementSelect: React.FC<EditProps> = ({ record, options, dataIndex, saveEditedCell }) => (
  <Select
    mode="multiple"
    placeholder="请选择补充资料"
    autoFocus
    allowClear
    style={{ width: '100%' }}
    options={options}
    onBlur={() => record.id && saveEditedCell(record.id)}
  />
);

// saveEditedCell方法中处理station_management字段的"日期"选项部分
interface EditCellProps {
  dataIndex: string;
  values: {
    station_management?: string[];
    [key: string]: any;
  };
  updateData: {
    [key: string]: any;
  };
}

const handleStationManagement = ({ dataIndex, values, updateData }: EditCellProps) => {
  if (dataIndex === 'station_management') {
    // 检查是否选择了"日期"选项
    if (Array.isArray(values.station_management) && values.station_management.includes('日期')) {
      // 创建当前时间戳
      const currentTimestamp = new Date().toISOString();
      
      // 从选项中移除"日期"，并添加时间戳
      const optionsWithoutDate = values.station_management.filter(item => item !== '日期');
      
      // 如果只选了"日期"且没有其他选项，将时间戳作为单独值
      if (optionsWithoutDate.length === 0) {
        updateData[dataIndex] = currentTimestamp;
      } else {
        // 如果有其他选项，则保留选项并额外保存时间戳
        // 这里依赖于前端的渲染逻辑来区分显示
        updateData[dataIndex] = [...optionsWithoutDate, currentTimestamp];
      }
      
      console.log('检测到"日期"选项，添加时间戳:', currentTimestamp);
    }
  }
};
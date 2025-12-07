import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const data = Array.from({ length: 30 }, (_, i) => ({
  time: i,
  size: Math.floor(Math.random() * 5000) + 1000,
  fee: Math.floor(Math.random() * 20) + 5
}));

export const MempoolGraph = () => {
  return (
    <div className="h-48 w-full bg-black/20 border-b border-border mb-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorSize" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
          <XAxis dataKey="time" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#000', border: '1px solid #333', color: '#10b981' }}
            itemStyle={{ color: '#10b981' }}
            formatter={(value: number) => [`${value} MB`, 'Size']}
            labelFormatter={() => ''}
          />
          <Area 
            type="monotone" 
            dataKey="size" 
            stroke="#10b981" 
            fillOpacity={1} 
            fill="url(#colorSize)" 
            strokeWidth={2}
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
